import { backendStatusLabel, type BackendStatus } from "./useBackendStatus";

type BackendStatusProps = {
  status: BackendStatus;
  kernelVersion?: string | null;
};

export default function BackendStatus({ status, kernelVersion }: BackendStatusProps) {
  const label = backendStatusLabel(status);
  const detail =
    status === "connected" && kernelVersion ? `kernel v${kernelVersion}` : label;

  return (
    <div
      className="backend-status"
      data-status={status}
      role="status"
      aria-label={`Backend ${label.toLowerCase()}`}
    >
      <span className="backend-status-dot" aria-hidden="true" />
      <span className="backend-status-label">{detail}</span>
    </div>
  );
}
