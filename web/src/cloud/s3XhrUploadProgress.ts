import type { S3Client } from "@aws-sdk/client-s3";
import { XhrHttpHandler } from "@aws-sdk/xhr-http-handler";

/** Minimal shape used to read S3 UploadPart query params from Smithy requests. */
export type SmithyHttpRequest = {
  query?: Record<string, string | string[] | undefined>;
};

export const MULTIPART_UPLOAD_QUEUE_SIZE = 4;
/** @deprecated Use MULTIPART_UPLOAD_QUEUE_SIZE */
export const RESUME_UPLOAD_QUEUE_SIZE = MULTIPART_UPLOAD_QUEUE_SIZE;

export function xhrHttpHandlerFromClient(client: S3Client): XhrHttpHandler | null {
  const handler = client.config.requestHandler;
  if (handler instanceof XhrHttpHandler) {
    return handler;
  }
  return null;
}

export function uploadPartNumberFromRequest(request: SmithyHttpRequest): number | null {
  const raw = request.query?.partNumber ?? request.query?.["partNumber"];
  if (raw == null) {
    return null;
  }
  const parsed = Number(Array.isArray(raw) ? raw[0] : raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function aggregateMultipartBytesInFlight(
  committedBytes: number,
  inFlightLoadedByPart: ReadonlyMap<number, number>,
): number {
  let total = committedBytes;
  for (const loaded of inFlightLoadedByPart.values()) {
    total += loaded;
  }
  return total;
}

type UploadProgressEvent = { loaded: number; lengthComputable: boolean };

type XhrProgressEmitter = {
  on(
    event: typeof XhrHttpHandler.EVENTS.UPLOAD_PROGRESS,
    listener: (event: UploadProgressEvent, request: SmithyHttpRequest) => void,
  ): void;
  off(
    event: typeof XhrHttpHandler.EVENTS.UPLOAD_PROGRESS,
    listener: (event: UploadProgressEvent, request: SmithyHttpRequest) => void,
  ): void;
};

export function attachPartUploadProgressListener(
  handler: XhrHttpHandler,
  partNumber: number,
  onLoaded: (loaded: number) => void,
): () => void {
  const emitter = handler as XhrHttpHandler & XhrProgressEmitter;
  const listener = (event: UploadProgressEvent, request: SmithyHttpRequest) => {
    if (uploadPartNumberFromRequest(request) !== partNumber) {
      return;
    }
    if (event.lengthComputable) {
      onLoaded(event.loaded);
    }
  };
  emitter.on(XhrHttpHandler.EVENTS.UPLOAD_PROGRESS, listener);
  return () => {
    emitter.off(XhrHttpHandler.EVENTS.UPLOAD_PROGRESS, listener);
  };
}

/** In-flight progress for single PutObject uploads (no partNumber query param). */
export function attachGenericUploadProgressListener(
  handler: XhrHttpHandler,
  onLoaded: (loaded: number) => void,
): () => void {
  const emitter = handler as XhrHttpHandler & XhrProgressEmitter;
  const listener = (event: UploadProgressEvent, request: SmithyHttpRequest) => {
    if (uploadPartNumberFromRequest(request) != null) {
      return;
    }
    if (event.lengthComputable) {
      onLoaded(event.loaded);
    }
  };
  emitter.on(XhrHttpHandler.EVENTS.UPLOAD_PROGRESS, listener);
  return () => {
    emitter.off(XhrHttpHandler.EVENTS.UPLOAD_PROGRESS, listener);
  };
}

export async function runWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) {
    return [];
  }
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  const runWorker = async () => {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) {
        return;
      }
      results[index] = await worker(items[index]!);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker()),
  );
  return results;
}
