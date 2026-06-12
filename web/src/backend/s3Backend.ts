import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  S3Client,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";
import { runS3FileAction } from "./s3FileOperations";
import type { RunActionParams } from "./runActionParams";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { XhrHttpHandler } from "@aws-sdk/xhr-http-handler";

import {
  computeMultipartPartSize,
  multipartSessionScopeId,
  pruneStaleMultipartRecords,
  readScopedMultipartRecords,
  removeMultipartRecord,
  upsertMultipartRecord,
  type MultipartSessionRecord,
} from "../cloud/multipartSessions";
import {
  listInProgressMultipartUploads,
  listUploadedParts,
  mergeMultipartSessions,
  multipartBytesUploaded,
  type MergedMultipartSession,
} from "../cloud/s3Multipart";
import {
  abortMultipartUpload,
  uploadMultipartFile,
} from "../cloud/s3MultipartUpload";
import {
  explorerPathFromCommonPrefix,
  explorerPathFromObjectKey,
  listPrefixForPath,
  objectKeyForPath,
} from "../cloud/s3Paths";
import type { S3ConnectionConfig } from "../cloud/types";
import { sha256Base64, sha256Base64Matches } from "../fileHash";
import {
  readUploadChecksumValidation,
  uploadChecksumValidationEnabled,
} from "../settings/uploadChecksumSettings";
import type {
  BackendEvent,
  BackendStatus,
  ExplorerBackend,
  FileEntry,
  FileStat,
  HealthInfo,
  ListResult,
  TusUploadResume,
  UploadCallbacks,
  UploadProgress,
} from "./types";

const PRESIGN_TTL_SECONDS = 3600;

function isUploadAbortError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === "AbortError") {
    return true;
  }
  return err instanceof Error && err.name === "AbortError";
}

function isUploadPauseAbort(signal?: AbortSignal): boolean {
  const reason = signal?.reason;
  if (reason instanceof DOMException && reason.name === "PauseError") {
    return true;
  }
  return reason instanceof Error && reason.name === "PauseError";
}

function keyForExplorerPath(bucketPrefix: string, explorerPath: string): string {
  const segments = explorerPath.split("/").filter(Boolean);
  const name = segments.pop() ?? "";
  const parent = segments.join("/");
  return objectKeyForPath(bucketPrefix, parent, name);
}

function createS3Client(config: S3ConnectionConfig): S3Client {
  const clientConfig: S3ClientConfig = {
    region: config.region,
    credentials: {
      accessKeyId: config.credentials.accessKeyId,
      secretAccessKey: config.credentials.secretAccessKey,
      sessionToken: config.credentials.sessionToken,
    },
    // AWS SDK v3.729+ defaults to CRC checksums on uploads; R2 does not implement them.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    // Fetch has no upload progress; XhrHttpHandler enables in-flight upload progress events.
    requestHandler: new XhrHttpHandler({}),
  };
  if (config.endpoint) {
    clientConfig.endpoint = config.endpoint;
    clientConfig.forcePathStyle = config.provider === "r2";
  }
  return new S3Client(clientConfig);
}

export async function validateS3Connection(config: S3ConnectionConfig): Promise<void> {
  const client = createS3Client(config);
  await client.send(new HeadBucketCommand({ Bucket: config.bucket }));
}

export class S3Backend implements ExplorerBackend {
  readonly mode = "s3" as const;
  private readonly client: S3Client;
  private readonly config: S3ConnectionConfig;

  constructor(config: S3ConnectionConfig) {
    this.config = config;
    this.client = createS3Client(config);
  }

  get connectionConfig(): S3ConnectionConfig {
    return this.config;
  }

  async list(path: string, cursor?: string): Promise<ListResult> {
    const prefix = listPrefixForPath(this.config.prefix, path);
    const response = await this.client.send(
      new ListObjectsV2Command({
        Bucket: this.config.bucket,
        Prefix: prefix || undefined,
        Delimiter: "/",
        ContinuationToken: cursor,
        MaxKeys: 1000,
      }),
    );

    const entries: FileEntry[] = [];
    const seen = new Set<string>();

    for (const commonPrefix of response.CommonPrefixes ?? []) {
      if (!commonPrefix.Prefix) {
        continue;
      }
      const mapped = explorerPathFromCommonPrefix(this.config.prefix, commonPrefix.Prefix);
      if (!mapped || seen.has(mapped.path)) {
        continue;
      }
      seen.add(mapped.path);
      entries.push({
        name: mapped.name,
        path: mapped.path,
        is_dir: true,
        size: 0,
      });
    }

    for (const object of response.Contents ?? []) {
      if (!object.Key || object.Key === prefix) {
        continue;
      }
      const mapped = explorerPathFromObjectKey(this.config.prefix, object.Key);
      if (!mapped || seen.has(mapped.path)) {
        continue;
      }
      seen.add(mapped.path);
      entries.push({
        name: mapped.name,
        path: mapped.path,
        is_dir: false,
        size: object.Size ?? 0,
        modified: object.LastModified?.toISOString(),
      });
    }

    entries.sort((a, b) => {
      if (a.is_dir !== b.is_dir) {
        return a.is_dir ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    return {
      entries,
      nextCursor: response.IsTruncated ? response.NextContinuationToken : undefined,
    };
  }

  async stat(path: string): Promise<FileStat> {
    const key = keyForExplorerPath(this.config.prefix, path);

    try {
      const head = await this.client.send(
        new HeadObjectCommand({
          Bucket: this.config.bucket,
          Key: key,
        }),
      );
      const extra: Record<string, unknown> = {};
      if (head.ContentType) {
        extra.contentType = head.ContentType;
      }
      if (head.ETag) {
        extra.etag = head.ETag;
      }
      if (head.StorageClass) {
        extra.storageClass = head.StorageClass;
      }
      return {
        path,
        is_dir: false,
        size: head.ContentLength ?? 0,
        modified: head.LastModified?.toISOString(),
        extra: Object.keys(extra).length > 0 ? extra : undefined,
      };
    } catch {
      const prefix = listPrefixForPath(this.config.prefix, path);
      const listing = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.config.bucket,
          Prefix: prefix,
          Delimiter: "/",
          MaxKeys: 1,
        }),
      );
      const hasChildren =
        (listing.CommonPrefixes?.length ?? 0) > 0 || (listing.Contents?.length ?? 0) > 0;
      if (!hasChildren) {
        throw new Error(`object not found: ${path}`);
      }
      return {
        path,
        is_dir: true,
        size: 0,
      };
    }
  }

  downloadUrl(path: string): Promise<string> {
    const key = keyForExplorerPath(this.config.prefix, path);
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
      }),
      { expiresIn: PRESIGN_TTL_SECONDS },
    );
  }

  async listMultipartSessions(): Promise<MergedMultipartSession[]> {
    const scopeId = multipartSessionScopeId(this.config);
    const listed = await listInProgressMultipartUploads(
      this.client,
      this.config.bucket,
      this.config.prefix,
    );
    pruneStaleMultipartRecords(scopeId, new Set(listed.map((upload) => upload.uploadId)));
    const localRecords = readScopedMultipartRecords(scopeId);
    const bytesUploadedByUploadId = new Map<string, number>();
    await Promise.all(
      listed.map(async (upload) => {
        const parts = await listUploadedParts(
          this.client,
          this.config.bucket,
          upload.objectKey,
          upload.uploadId,
        );
        bytesUploadedByUploadId.set(upload.uploadId, multipartBytesUploaded(parts));
      }),
    );
    return mergeMultipartSessions(
      listed,
      localRecords,
      this.config.prefix,
      bytesUploadedByUploadId,
    );
  }

  async abortMultipartSession(objectKey: string, uploadId: string): Promise<void> {
    await abortMultipartUpload(this.client, this.config.bucket, objectKey, uploadId);
  }

  async resumeUpload(
    file: File,
    record: MultipartSessionRecord,
    onProgress?: (progress: UploadProgress) => void,
    signal?: AbortSignal,
    callbacks?: UploadCallbacks,
  ): Promise<void> {
    if (this.config.readOnly) {
      throw new Error("bucket is read-only");
    }
    if (signal?.aborted) {
      throw new DOMException("Upload aborted", "AbortError");
    }

    const checksumValidation = record.checksumValidation;
    let checksum: string | null = record.checksumSha256Base64 ?? null;
    if (checksumValidation && checksum == null) {
      callbacks?.onHashing?.();
      checksum = await sha256Base64(file, undefined, signal, (offset, total) => {
        onProgress?.({ id: "hashing", offset, length: total });
      });
      this.persistMultipartRecord(
        file,
        record.destPath,
        record.objectKey,
        record.uploadId,
        record.partSize,
        checksumValidation,
        checksum,
      );
    }

    callbacks?.onUploadStart?.();
    const key = record.objectKey;
    try {
      await uploadMultipartFile(
        this.client,
        {
          bucket: this.config.bucket,
          objectKey: key,
          uploadId: record.uploadId,
          body: file,
          partSize: record.partSize,
          contentType: file.type || undefined,
          checksumAlgorithm: checksumValidation ? "SHA256" : undefined,
        },
        {
          onProgress: (loaded, total) => {
            onProgress?.({
              id: key,
              offset: loaded,
              length: total,
              multipartUploadId: record.uploadId,
            });
          },
          signal,
        },
      );
    } catch (err) {
      if (!isUploadAbortError(err)) {
        this.persistMultipartRecord(
          file,
          record.destPath,
          key,
          record.uploadId,
          record.partSize,
          checksumValidation,
          checksum ?? undefined,
        );
      }
      throw err;
    }

    const scopeId = multipartSessionScopeId(this.config);
    removeMultipartRecord(scopeId, record.uploadId);

    if (!checksumValidation || checksum == null) {
      return;
    }

    callbacks?.onVerifying?.();
    const verified = await sha256Base64Matches(file, checksum, undefined, signal, (offset, total) => {
      onProgress?.({ id: "verifying", offset, length: total });
    });
    if (!verified) {
      await this.deleteUploadedObject(key);
      throw new Error("checksum mismatch");
    }
  }

  async upload(
    file: File,
    destPath: string,
    onProgress?: (progress: UploadProgress) => void,
    signal?: AbortSignal,
    callbacks?: UploadCallbacks,
    _tusResume?: TusUploadResume,
  ): Promise<void> {
    if (this.config.readOnly) {
      throw new Error("bucket is read-only");
    }
    if (signal?.aborted) {
      throw new DOMException("Upload aborted", "AbortError");
    }
    const checksumValidation = uploadChecksumValidationEnabled(
      this.config.provider,
      readUploadChecksumValidation(),
    );
    let checksum: string | null = null;
    if (checksumValidation) {
      callbacks?.onHashing?.();
      checksum = await sha256Base64(file, undefined, signal, (offset, total) => {
        onProgress?.({ id: "hashing", offset, length: total });
      });
    }
    callbacks?.onUploadStart?.();
    const key = keyForExplorerPath(this.config.prefix, destPath);
    const partSize = computeMultipartPartSize(file.size);
    let activeUploadId: string | null = null;
    const onAbort = () => {
      if (isUploadPauseAbort(signal)) {
        return;
      }
      if (activeUploadId) {
        void abortMultipartUpload(
          this.client,
          this.config.bucket,
          key,
          activeUploadId,
        ).catch(() => {});
      }
    };
    signal?.addEventListener("abort", onAbort, { once: true });
    try {
      const { uploadId } = await uploadMultipartFile(
        this.client,
        {
          bucket: this.config.bucket,
          objectKey: key,
          body: file,
          partSize,
          contentType: file.type || undefined,
          checksumAlgorithm: checksumValidation ? "SHA256" : undefined,
        },
        {
          onUploadCreated: (createdUploadId) => {
            activeUploadId = createdUploadId;
            this.persistMultipartRecord(
              file,
              destPath,
              key,
              createdUploadId,
              partSize,
              checksumValidation,
              checksum ?? undefined,
            );
          },
          onProgress: (loaded, total) => {
            onProgress?.({
              id: key,
              offset: loaded,
              length: total,
              multipartUploadId: activeUploadId ?? undefined,
            });
          },
          signal,
        },
      );
      if (uploadId) {
        removeMultipartRecord(multipartSessionScopeId(this.config), uploadId);
      }
    } catch (err) {
      if (!isUploadAbortError(err) && activeUploadId) {
        this.persistMultipartRecord(
          file,
          destPath,
          key,
          activeUploadId,
          partSize,
          checksumValidation,
          checksum ?? undefined,
        );
      }
      throw err;
    } finally {
      signal?.removeEventListener("abort", onAbort);
    }

    if (!checksumValidation || checksum == null) {
      return;
    }

    callbacks?.onVerifying?.();
    const verified = await sha256Base64Matches(file, checksum, undefined, signal, (offset, total) => {
      onProgress?.({ id: "verifying", offset, length: total });
    });
    if (!verified) {
      await this.deleteUploadedObject(key);
      throw new Error("checksum mismatch");
    }
  }

  private persistMultipartRecord(
    file: File,
    destPath: string,
    objectKey: string,
    uploadId: string,
    partSize: number,
    checksumValidation: boolean,
    checksumSha256Base64?: string,
  ): void {
    upsertMultipartRecord(multipartSessionScopeId(this.config), {
      uploadId,
      objectKey,
      destPath,
      fileName: file.name,
      fileSize: file.size,
      fileLastModified: file.lastModified,
      partSize,
      checksumValidation,
      checksumSha256Base64:
        checksumValidation && checksumSha256Base64 ? checksumSha256Base64 : undefined,
      createdAt: new Date().toISOString(),
    });
  }

  private async deleteUploadedObject(key: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.config.bucket,
          Key: key,
        }),
      );
    } catch {
      // Best-effort cleanup after a failed or mismatched upload.
    }
  }

  async runAction(params: RunActionParams): Promise<void> {
    if (this.config.readOnly) {
      throw new Error("bucket is read-only");
    }
    await runS3FileAction(
      this.client,
      this.config.bucket,
      this.config.prefix,
      params,
    );
  }

  async fetchHealth(): Promise<HealthInfo | null> {
    return { read_only: this.config.readOnly };
  }

  subscribe(
    onEvent: (event: BackendEvent) => void,
    onStatus?: (status: BackendStatus) => void,
  ): () => void {
    onStatus?.("connecting");
    onEvent({
      type: "connected",
      version: "s3",
      read_only: this.config.readOnly,
    });
    onStatus?.("connected");
    return () => {};
  }
}

export function createS3Backend(config: S3ConnectionConfig): S3Backend {
  return new S3Backend(config);
}
