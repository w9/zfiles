import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  type CompletedPart,
  type S3Client,
  UploadPartCommand,
} from "@aws-sdk/client-s3";

import { listUploadedParts, type ListedPart } from "./s3Multipart";
import {
  aggregateMultipartBytesInFlight,
  attachPartUploadProgressListener,
  RESUME_UPLOAD_QUEUE_SIZE,
  runWithConcurrency,
  xhrHttpHandlerFromClient,
} from "./s3XhrUploadProgress";

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException("Upload aborted", "AbortError");
  }
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

export async function resumeMultipartUpload(
  client: S3Client,
  params: {
    bucket: string;
    objectKey: string;
    uploadId: string;
    body: File;
    partSize: number;
    contentType?: string;
    checksumAlgorithm?: "SHA256";
  },
  onProgress?: (loaded: number, total: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  throwIfAborted(signal);
  const existingParts = await listUploadedParts(
    client,
    params.bucket,
    params.objectKey,
    params.uploadId,
  );
  const completedByNumber = new Map(
    existingParts.map((part) => [part.PartNumber ?? 0, part]),
  );

  const totalBytes = params.body.size;
  const expectedParts = Math.ceil(totalBytes / params.partSize);
  const missingParts: number[] = [];
  for (let partNumber = 1; partNumber <= expectedParts; partNumber += 1) {
    if (!completedByNumber.has(partNumber)) {
      missingParts.push(partNumber);
    }
  }

  let initialBytesCompleted = existingParts.reduce((sum, part) => sum + (part.Size ?? 0), 0);
  const finishedPartBytes = new Map<number, number>();
  const inFlightLoadedByPart = new Map<number, number>();
  const xhrHandler = xhrHttpHandlerFromClient(client);

  const reportProgress = () => {
    let committed = initialBytesCompleted;
    for (const size of finishedPartBytes.values()) {
      committed += size;
    }
    onProgress?.(
      aggregateMultipartBytesInFlight(committed, inFlightLoadedByPart),
      totalBytes,
    );
  };

  reportProgress();

  const uploadMissingPart = async (partNumber: number): Promise<ListedPart> => {
    throwIfAborted(signal);
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
          UploadId: params.uploadId,
          PartNumber: partNumber,
          Body: body,
          ...(params.checksumAlgorithm ? { ChecksumAlgorithm: params.checksumAlgorithm } : {}),
        }),
        signal ? { abortSignal: signal } : undefined,
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
      };
    } finally {
      detachProgress?.();
      inFlightLoadedByPart.delete(partNumber);
    }
  };

  const uploadedParts = await runWithConcurrency(
    missingParts,
    RESUME_UPLOAD_QUEUE_SIZE,
    uploadMissingPart,
  );

  const allParts: ListedPart[] = [...existingParts, ...uploadedParts];
  allParts.sort((a, b) => (a.PartNumber ?? 0) - (b.PartNumber ?? 0));
  await client.send(
    new CompleteMultipartUploadCommand({
      Bucket: params.bucket,
      Key: params.objectKey,
      UploadId: params.uploadId,
      MultipartUpload: {
        Parts: allParts.map(({ PartNumber, ETag }) => ({ PartNumber, ETag })),
      },
    }),
  );
}
