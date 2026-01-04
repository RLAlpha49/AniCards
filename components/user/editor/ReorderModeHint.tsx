"use client";

export function ReorderModeHint({
  isVisible,
}: Readonly<{ isVisible: boolean }>) {
  if (!isVisible) return null;

  return (
    <div className="rounded-xl border border-blue-200/60 bg-blue-50/60 px-4 py-2 text-xs text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/25 dark:text-blue-200">
      <span className="font-semibold">Reorder mode:</span> drag cards by the
      handle <span aria-label="three horizontal lines icon">(≡)</span> to change
      their order.
    </div>
  );
}
