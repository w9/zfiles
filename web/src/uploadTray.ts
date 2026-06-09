import type { UploadItemStatus, UploadQueueItem } from "./upload-queue";

/** Aggregate view of the upload queue used by the status-bar indicator. */
export type UploadTrayStats = {
  total: number;
  active: number;
  hashing: number;
  verifying: number;
  pending: number;
  /** Awaiting a conflict decision — paused, needs the user. */
  paused: number;
  failed: number;
  done: number;
  cancelled: number;
  /** active + hashing + verifying — something is moving right now. */
  inFlight: number;
  /** done + failed + cancelled — the reachable history. */
  finished: number;
  hasInFlight: boolean;
  /** in-flight, queued, or paused — a batch is still ongoing. */
  hasPendingWork: boolean;
  activeBytesTotal: number;
  activeBytesUploaded: number;
  /** Combined percent across actively transferring items, or null when idle. */
  percent: number | null;
  /** Combined bytes/sec across actively transferring items, or null. */
  speedBps: number | null;
  etaSeconds: number | null;
};

function emptyStatusCounts(): Record<UploadItemStatus, number> {
  return {
    pending: 0,
    hashing: 0,
    active: 0,
    verifying: 0,
    awaiting_conflict: 0,
    done: 0,
    failed: 0,
    cancelled: 0,
  };
}

export function aggregateUploadStats(items: UploadQueueItem[]): UploadTrayStats {
  const counts = emptyStatusCounts();
  let activeBytesTotal = 0;
  let activeBytesUploaded = 0;
  let speedSum = 0;
  let hasSpeedSample = false;

  for (const item of items) {
    counts[item.status] += 1;
    if (item.status === "active") {
      activeBytesTotal += item.total;
      activeBytesUploaded += Math.min(item.offset, item.total);
      if (item.speedBps != null) {
        speedSum += item.speedBps;
        hasSpeedSample = true;
      }
    }
  }

  const inFlight = counts.active + counts.hashing + counts.verifying;
  const paused = counts.awaiting_conflict;
  const finished = counts.done + counts.failed + counts.cancelled;
  const hasPendingWork = inFlight > 0 || counts.pending > 0 || paused > 0;

  const percent =
    activeBytesTotal > 0
      ? Math.min(100, Math.round((activeBytesUploaded / activeBytesTotal) * 100))
      : null;
  const speedBps = hasSpeedSample && speedSum > 0 ? speedSum : null;
  const remaining = activeBytesTotal - activeBytesUploaded;
  const etaSeconds =
    speedBps != null && speedBps > 0 && remaining > 0 ? remaining / speedBps : null;

  return {
    total: items.length,
    active: counts.active,
    hashing: counts.hashing,
    verifying: counts.verifying,
    pending: counts.pending,
    paused,
    failed: counts.failed,
    done: counts.done,
    cancelled: counts.cancelled,
    inFlight,
    finished,
    hasInFlight: inFlight > 0,
    hasPendingWork,
    activeBytesTotal,
    activeBytesUploaded,
    percent,
    speedBps,
    etaSeconds,
  };
}

/** Whether the queue holds something needing the user: paused or failed items. */
export function uploadTrayAttention(stats: UploadTrayStats): boolean {
  return stats.paused > 0 || stats.failed > 0;
}

/**
 * Tracks whether a batch's "pending work" was already observed, so the tray
 * auto-opens exactly once when a batch begins and re-arms after it drains.
 */
export type TrayAutoOpenState = { hadPendingWork: boolean };

export const initialTrayAutoOpenState: TrayAutoOpenState = {
  hadPendingWork: false,
};

export type TrayAutoOpenResult = {
  /** True only on the transition into a fresh batch of pending work. */
  open: boolean;
  state: TrayAutoOpenState;
};

export function reduceTrayAutoOpen(
  prev: TrayAutoOpenState,
  signal: { hasPendingWork: boolean },
): TrayAutoOpenResult {
  const open = !prev.hadPendingWork && signal.hasPendingWork;
  return { open, state: { hadPendingWork: signal.hasPendingWork } };
}
