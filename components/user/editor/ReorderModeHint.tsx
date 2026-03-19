"use client";

export function ReorderModeHint({
  isVisible,
}: Readonly<{ isVisible: boolean }>) {
  if (!isVisible) return null;

  return (
    <div className="border-gold/20 bg-gold/3 text-foreground dark:border-gold/15 dark:bg-gold/3 rounded-xl border px-4 py-2 text-xs">
      <span className="font-semibold">Reorder mode:</span> drag cards by the
      handle <span aria-label="three horizontal lines icon">(≡)</span> to change
      their order.
    </div>
  );
}
