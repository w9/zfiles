export type UnfinishedSessionView = {
  uploadId: string;
  destPath: string;
  fileName: string;
  initiated?: Date;
  bytesUploaded: number | null;
  totalBytes: number | null;
  canResume: boolean;
  resuming: boolean;
  aborting: boolean;
  remoteOnly: boolean;
  progressUnknown: boolean;
};

export function unfinishedSessionPercent(
  session: Pick<UnfinishedSessionView, "bytesUploaded" | "totalBytes">,
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

export function unfinishedSessionProgressUnknown(
  session: UnfinishedSessionView,
): boolean {
  return unfinishedSessionPercent(session) == null;
}
