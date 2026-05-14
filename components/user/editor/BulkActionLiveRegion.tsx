"use client";

export function BulkActionLiveRegion({
  message,
}: Readonly<{ message: string | null }>) {
  return (
    <span className="sr-only" aria-live="polite" aria-atomic="true">
      {message ?? ""}
    </span>
  );
}
