import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  type CompletedPart,
  PutObjectCommand,
  type S3Client,
  UploadPartCommand,
} from "@aws-sdk/client-s3";

import { listUploadedParts, type ListedPart } from "./s3Multipart";
import {
  aggregateMultipartBytesInFlight,
  attachGenericUploadProgressListener,
  attachPartUploadProgressListener,
  MULTIPART_UPLOAD_QUEUE_SIZE,
  runWithConcurrency,
  xhrHttpHandlerFromClient,
} from "./s3XhrUploadProgress";

export const MAX_MULTIPART_PARTS = 10_000;

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException("Upload aborted", "AbortError");
  }
}

export function missingPartNumbers(
  expectedParts: number,
  completedPartNumbers: ReadonlySet<number>,
): number[] {
  const missing: number[] = [];
  for (let partNumber = 1; partNumber <= expectedParts; partNumber += 1) {
    if (!completedPartNumbers.has(partNumber)) {
      missing.push(partNumber);
    }
  }
  return missing;
}

export function canUseSinglePutUpload(
  totalBytes: number,
  partSize: number,
  existingPartCount: number,
  hasUploadId: boolean,
): boolean {
  return !hasUploadId && existingPartCount === 0 && totalBytes <= partSize;
}

type ChecksumPartFields = Pick<
  CompletedPart,
  "ChecksumCRC32" | "ChecksumCRC32C" | "ChecksumSHA1" | "ChecksumSHA256"
>;

export function toCompletedPart(
  part: Pick<ListedPart, "PartNumber" | "ETag"> & Partial<ChecksumPartFields>,
): CompletedPart {
  if (part.PartNumber == null || !part.ETag) {
    throw new Error("completed part is missing PartNumber or ETag");
  }
  return {
    PartNumber: part.PartNumber,
    ETag: part.ETag,
    ...(part.ChecksumCRC32 ? { ChecksumCRC32: part.ChecksumCRC32 } : {}),
    ...(part.ChecksumCRC32C ? { ChecksumCRC32C: part.ChecksumCRC32C } : {}),
    ...(part.ChecksumSHA1 ? { ChecksumSHA1: part.ChecksumSHA1 } : {}),
    ...(part.ChecksumSHA256 ? { ChecksumSHA256: part.ChecksumSHA256 } : {}),
  };
}

function checksumFieldsFromPart(part: Partial<ChecksumPartFields>): Partial<ChecksumPartFields> {
  return {
    ...(part.ChecksumCRC32 ? { ChecksumCRC32: part.ChecksumCRC32 } : {}),
    ...(part.ChecksumCRC32C ? { ChecksumCRC32C: part.ChecksumCRC32C } : {}),
    ...(part.ChecksumSHA1 ? { ChecksumSHA1: part.ChecksumSHA1 } : {}),
    ...(part.ChecksumSHA256 ? { ChecksumSHA256: part.ChecksumSHA256 } : {}),
  };
}

export async function abortMultipartUpload(
  client: S3Client,
  bucket: string,
  objectKey: string,
  uploadId: string,
): Promise<void> {
  await client.send(
    new AbortMultipartUploadCommand({
      Bucket: bucket,
      Key: objectKey,
      UploadId: uploadId,
    }),
  );
}

export type MultipartUploadParams = {
  bucket: string;
  objectKey: string;
  body: File;
  partSize: number;
  contentType?: string;
  checksumAlgorithm?: "SHA256";
  /** When set, continue an existing multipart session instead of creating one. */
  uploadId?: string;
};

export type MultipartUploadOptions = {
  onProgress?: (loaded: number, total: number) => void;
  onUploadCreated?: (uploadId: string) => void;
  signal?: AbortSignal;
};

async function uploadSinglePut(
  client: S3Client,
  params: MultipartUploadParams,
  onProgress?: (loaded: number, total: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  throwIfAborted(signal);
  const totalBytes = params.body.size;
  onProgress?.(0, totalBytes);

  const xhrHandler = xhrHttpHandlerFromClient(client);
  let detachProgress: (() => void) | undefined;
  if (xhrHandler) {
    detachProgress = attachGenericUploadProgressListener(xhrHandler, (loaded) => {
      onProgress?.(Math.min(loaded, totalBytes), totalBytes);
    });
  }

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: params.bucket,
        Key: params.objectKey,
        Body: params.body,
        ContentType: params.contentType,
        ...(params.checksumAlgorithm
          ? { ChecksumAlgorithm: params.checksumAlgorithm }
          : {}),
      }),
      signal ? { abortSignal: signal } : undefined,
    );
    onProgress?.(totalBytes, totalBytes);
  } finally {
    detachProgress?.();
  }
}

export async function uploadMultipartFile(
  client: S3Client,
  params: MultipartUploadParams,
  options?: MultipartUploadOptions,
): Promise<{ uploadId: string }> {
  throwIfAborted(options?.signal);
  const totalBytes = params.body.size;
  const expectedParts = Math.ceil(totalBytes / params.partSize);
  if (expectedParts > MAX_MULTIPART_PARTS) {
    throw new Error(`upload exceeds ${MAX_MULTIPART_PARTS} parts`);
  }

  let uploadId = params.uploadId;
  let existingParts: ListedPart[] = [];
  if (uploadId) {
    existingParts = await listUploadedParts(
      client,
      params.bucket,
      params.objectKey,
      uploadId,
    );
  }

  if (
    canUseSinglePutUpload(
      totalBytes,
      params.partSize,
      existingParts.length,
      uploadId != null,
    )
  ) {
    await uploadSinglePut(client, params, options?.onProgress, options?.signal);
    return { uploadId: "" };
  }

  if (!uploadId) {
    const createResult = await client.send(
      new CreateMultipartUploadCommand({
        Bucket: params.bucket,
        Key: params.objectKey,
        ContentType: params.contentType,
        ...(params.checksumAlgorithm
          ? { ChecksumAlgorithm: params.checksumAlgorithm }
          : {}),
      }),
      options?.signal ? { abortSignal: options.signal } : undefined,
    );
    uploadId = createResult.UploadId;
    if (!uploadId) {
      throw new Error("CreateMultipartUpload missing UploadId");
    }
    options?.onUploadCreated?.(uploadId);
  }

  const completedByNumber = new Map(
    existingParts.map((part) => [part.PartNumber ?? 0, part]),
  );
  const missingParts = missingPartNumbers(
    expectedParts,
    new Set(completedByNumber.keys()),
  );

  let initialBytesCompleted = existingParts.reduce((sum, part) => sum + (part.Size ?? 0), 0);
  const finishedPartBytes = new Map<number, number>();
  const inFlightLoadedByPart = new Map<number, number>();
  const xhrHandler = xhrHttpHandlerFromClient(client);

  const reportProgress = () => {
    let committed = initialBytesCompleted;
    for (const size of finishedPartBytes.values()) {
      committed += size;
    }
    options?.onProgress?.(
      aggregateMultipartBytesInFlight(committed, inFlightLoadedByPart),
      totalBytes,
    );
  };

  reportProgress();

  const uploadMissingPart = async (partNumber: number): Promise<ListedPart> => {
    throwIfAborted(options?.signal);
    const start = (partNumber - 1) * params.partSize;
    const end = Math.min(start + params.partSize, totalBytes);
    const chunk = params.body.slice(start, end);
    const body = new Uint8Array(await chunk.arrayBuffer());

    let detachProgress: (() => void) | undefined;
    if (xhrHandler) {
      detachProgress = attachPartUploadProgressListener(xhrHandler, partNumber, (loaded) => {
        inFlightLoadedByPart.set(partNumber, loaded);
        reportProgress();
      });
    }

    try {
      const partResult = await client.send(
        new UploadPartCommand({
          Bucket: params.bucket,
          Key: params.objectKey,
          UploadId: uploadId,
          PartNumber: partNumber,
          Body: body,
          ...(params.checksumAlgorithm
            ? { ChecksumAlgorithm: params.checksumAlgorithm }
            : {}),
        }),
        options?.signal ? { abortSignal: options.signal } : undefined,
      );

      if (!partResult.ETag) {
        throw new Error(`part ${partNumber} is missing ETag in UploadPart response`);
      }

      finishedPartBytes.set(partNumber, chunk.size);
      inFlightLoadedByPart.delete(partNumber);
      reportProgress();

      return {
        PartNumber: partNumber,
        ETag: partResult.ETag,
        Size: chunk.size,
        ...checksumFieldsFromPart(partResult),
      };
    } finally {
      detachProgress?.();
      inFlightLoadedByPart.delete(partNumber);
    }
  };

  const uploadedParts = await runWithConcurrency(
    missingParts,
    MULTIPART_UPLOAD_QUEUE_SIZE,
    uploadMissingPart,
  );

  const allParts: ListedPart[] = [...existingParts, ...uploadedParts];
  allParts.sort((a, b) => (a.PartNumber ?? 0) - (b.PartNumber ?? 0));

  if (allParts.length !== expectedParts) {
    throw new Error(`expected ${expectedParts} parts but have ${allParts.length}`);
  }

  await client.send(
    new CompleteMultipartUploadCommand({
      Bucket: params.bucket,
      Key: params.objectKey,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: allParts.map((part) => toCompletedPart(part)),
      },
    }),
    options?.signal ? { abortSignal: options.signal } : undefined,
  );

  return { uploadId };
}
