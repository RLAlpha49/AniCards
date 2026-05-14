import { cn } from "@/lib/utils";

/**
 * Simple skeleton placeholder used to indicate loading states for elements.
 * Apply custom className to adjust size or shape when rendering placeholders.
 * @source
 */
function Skeleton({
  className,
  ...props
}: Readonly<React.HTMLAttributes<HTMLDivElement>>) {
  return (
    <div className={cn("animate-pulse bg-primary/10", className)} {...props} />
  );
}

export { Skeleton };
