import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  type CompletedPart,
  type S3Client,
  UploadPartCommand,
} from "@aws-sdk/client-s3";

import { listUploadedParts, type ListedPart } from "./s3Multipart";

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
  let bytesUploaded = existingParts.reduce((sum, part) => sum + (part.Size ?? 0), 0);
  onProgress?.(bytesUploaded, totalBytes);

  const allParts: ListedPart[] = [...existingParts];

  for (let partNumber = 1; partNumber <= expectedParts; partNumber += 1) {
    if (completedByNumber.has(partNumber)) {
      continue;
    }
    throwIfAborted(signal);

    const start = (partNumber - 1) * params.partSize;
    const end = Math.min(start + params.partSize, totalBytes);
    const chunk = params.body.slice(start, end);
    const body = new Uint8Array(await chunk.arrayBuffer());

    const partResult = await client.send(
      new UploadPartCommand({
        Bucket: params.bucket,
        Key: params.objectKey,
        UploadId: params.uploadId,
        PartNumber: partNumber,
        Body: body,
        ...(params.checksumAlgorithm ? { ChecksumAlgorithm: params.checksumAlgorithm } : {}),
      }),
    );

    if (!partResult.ETag) {
      throw new Error(`part ${partNumber} is missing ETag in UploadPart response`);
    }

    const completedPart: CompletedPart = {
      PartNumber: partNumber,
      ETag: partResult.ETag,
    };
    allParts.push({ ...completedPart, Size: chunk.size });
    bytesUploaded += chunk.size;
    onProgress?.(bytesUploaded, totalBytes);
  }

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
