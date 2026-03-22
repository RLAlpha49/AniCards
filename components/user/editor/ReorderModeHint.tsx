"use client";

export function ReorderModeHint({
  isVisible,
}: Readonly<{ isVisible: boolean }>) {
  if (!isVisible) return null;

  return (
    <div className="
      border border-gold/20 bg-gold/3 px-4 py-2 text-xs text-foreground
      dark:border-gold/15 dark:bg-gold/3
    ">
      <span className="font-semibold">Reorder mode:</span> drag cards by the
      handle <span aria-label="three horizontal lines icon">(≡)</span> to change
      their order.
    </div>
  );
}
