import {
  type CompletedPart,
  type S3Client,
  ListMultipartUploadsCommand,
  ListPartsCommand,
} from "@aws-sdk/client-s3";

import { explorerPathFromObjectKey, normalizeBucketPrefix } from "./s3Paths";
import type { MultipartSessionRecord } from "./multipartSessions";

export type S3ListedMultipartUpload = {
  uploadId: string;
  objectKey: string;
  initiated?: Date;
};

export type ListedPart = CompletedPart & { Size?: number };

export type MergedMultipartSession = {
  uploadId: string;
  objectKey: string;
  destPath: string;
  fileName: string;
  initiated?: Date;
  bytesUploaded: number | null;
  totalBytes: number | null;
  canResume: boolean;
  localRecord: MultipartSessionRecord | null;
};

export function multipartBytesUploaded(parts: ListedPart[]): number {
  return parts.reduce((sum, part) => sum + (part.Size ?? 0), 0);
}

/** Upload progress as a 0–100 integer, or null when the total size is unknown. */
export function multipartPercent(
  session: Pick<MergedMultipartSession, "bytesUploaded" | "totalBytes">,
): number | null {
  if (
    session.bytesUploaded == null ||
    session.totalBytes == null ||
    session.totalBytes <= 0
  ) {
    return null;
  }
  return Math.min(
    100,
    Math.round((session.bytesUploaded / session.totalBytes) * 100),
  );
}

export function mergeMultipartSessions(
  listed: S3ListedMultipartUpload[],
  localRecords: MultipartSessionRecord[],
  bucketPrefix: string,
  bytesUploadedByUploadId: ReadonlyMap<string, number>,
): MergedMultipartSession[] {
  const localByUploadId = new Map(localRecords.map((record) => [record.uploadId, record]));
  const seen = new Set<string>();

  const merged = listed.map((upload) => {
    seen.add(upload.uploadId);
    const localRecord = localByUploadId.get(upload.uploadId) ?? null;
    const mapped = explorerPathFromObjectKey(bucketPrefix, upload.objectKey);
    const destPath = localRecord?.destPath ?? mapped?.path ?? upload.objectKey;
    const fileName = localRecord?.fileName ?? mapped?.name ?? upload.objectKey.split("/").pop() ?? upload.objectKey;
    const bytesUploaded = bytesUploadedByUploadId.get(upload.uploadId) ?? null;

    return {
      uploadId: upload.uploadId,
      objectKey: upload.objectKey,
      destPath,
      fileName,
      initiated: upload.initiated,
      bytesUploaded,
      totalBytes: localRecord?.fileSize ?? null,
      canResume: localRecord != null,
      localRecord,
    } satisfies MergedMultipartSession;
  });

  for (const record of localRecords) {
    if (seen.has(record.uploadId)) {
      continue;
    }
    merged.push({
      uploadId: record.uploadId,
      objectKey: record.objectKey,
      destPath: record.destPath,
      fileName: record.fileName,
      initiated: new Date(record.createdAt),
      bytesUploaded: bytesUploadedByUploadId.get(record.uploadId) ?? null,
      totalBytes: record.fileSize,
      canResume: true,
      localRecord: record,
    });
  }

  merged.sort((a, b) => {
    const aTime = a.initiated?.getTime() ?? 0;
    const bTime = b.initiated?.getTime() ?? 0;
    return bTime - aTime;
  });

  return merged;
}

export async function listInProgressMultipartUploads(
  client: S3Client,
  bucket: string,
  bucketPrefix: string,
): Promise<S3ListedMultipartUpload[]> {
  const prefix = normalizeBucketPrefix(bucketPrefix);
  const uploads: S3ListedMultipartUpload[] = [];
  let keyMarker: string | undefined;
  let uploadIdMarker: string | undefined;

  do {
    const response = await client.send(
      new ListMultipartUploadsCommand({
        Bucket: bucket,
        Prefix: prefix || undefined,
        KeyMarker: keyMarker,
        UploadIdMarker: uploadIdMarker,
      }),
    );

    for (const upload of response.Uploads ?? []) {
      if (!upload.Key || !upload.UploadId) {
        continue;
      }
      uploads.push({
        objectKey: upload.Key,
        uploadId: upload.UploadId,
        initiated: upload.Initiated,
      });
    }

    if (!response.IsTruncated) {
      break;
    }
    keyMarker = response.NextKeyMarker;
    uploadIdMarker = response.NextUploadIdMarker;
  } while (keyMarker && uploadIdMarker);

  return uploads;
}

export async function listUploadedParts(
  client: S3Client,
  bucket: string,
  objectKey: string,
  uploadId: string,
): Promise<ListedPart[]> {
  const parts: ListedPart[] = [];
  let partNumberMarker: string | undefined;

  do {
    const response = await client.send(
      new ListPartsCommand({
        Bucket: bucket,
        Key: objectKey,
        UploadId: uploadId,
        PartNumberMarker: partNumberMarker,
      }),
    );

    for (const part of response.Parts ?? []) {
      if (!part.PartNumber || !part.ETag) {
        continue;
      }
      parts.push({
        PartNumber: part.PartNumber,
        ETag: part.ETag,
        Size: part.Size,
      });
    }

    if (!response.IsTruncated) {
      break;
    }
    partNumberMarker = response.NextPartNumberMarker;
  } while (partNumberMarker);

  return parts;
}
