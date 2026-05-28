import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  S3Client,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import {
  explorerPathFromCommonPrefix,
  explorerPathFromObjectKey,
  listPrefixForPath,
  objectKeyForPath,
} from "../cloud/s3Paths";
import type { S3ConnectionConfig } from "../cloud/types";
import type {
  BackendEvent,
  BackendStatus,
  ExplorerBackend,
  FileEntry,
  FileStat,
  HealthInfo,
  ListResult,
  UploadProgress,
} from "./types";

const PRESIGN_TTL_SECONDS = 3600;

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
      return {
        path,
        is_dir: false,
        size: head.ContentLength ?? 0,
        modified: head.LastModified?.toISOString(),
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

  async upload(
    file: File,
    destPath: string,
    onProgress?: (progress: UploadProgress) => void,
  ): Promise<void> {
    if (this.config.readOnly) {
      throw new Error("bucket is read-only");
    }
    const key = keyForExplorerPath(this.config.prefix, destPath);
    const upload = new Upload({
      client: this.client,
      params: {
        Bucket: this.config.bucket,
        Key: key,
        Body: file,
        ContentType: file.type || undefined,
      },
    });
    upload.on("httpUploadProgress", (progress) => {
      if (progress.loaded == null) {
        return;
      }
      onProgress?.({
        id: key,
        offset: progress.loaded,
        length: progress.total ?? file.size,
      });
    });
    await upload.done();
  }

  async runAction(actionId: string, paths: string[]): Promise<void> {
    if (actionId !== "file.delete") {
      throw new Error(`unknown action: ${actionId}`);
    }
    if (this.config.readOnly) {
      throw new Error("bucket is read-only");
    }
    for (const path of paths) {
      const key = keyForExplorerPath(this.config.prefix, path);
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.config.bucket,
          Key: key,
        }),
      );
    }
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
