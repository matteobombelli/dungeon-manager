import type { SaveStatus } from "./useAutosave";

const LABELS: Record<SaveStatus, string> = {
  idle: "Up to date",
  dirty: "Unsaved",
  saving: "Saving",
  saved: "Saved",
  error: "Save failed",
};

export function SaveIndicator({ status, error }: { status: SaveStatus; error: string | null }) {
  const label = LABELS[status];
  return (
    <span
      className={`save-dot save-dot--${status}`}
      role="status"
      aria-label={label}
      title={label + (error ? `: ${error}` : "")}
    />
  );
}
