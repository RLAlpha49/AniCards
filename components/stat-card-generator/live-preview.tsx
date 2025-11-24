import React from "react";
import { cn } from "@/lib/utils";

interface LivePreviewProps {
  previewSVG: string;
  className?: string;
}

export const LivePreview = React.memo(function LivePreview({
  previewSVG,
  className,
}: LivePreviewProps) {
  return (
    <div className={cn("flex flex-col items-center space-y-3", className)}>
      <div className="flex justify-center">
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50/50 p-4 shadow-sm transition-all dark:border-gray-800 dark:bg-gray-900/50">
          <div
            dangerouslySetInnerHTML={{ __html: previewSVG }}
            className="transition-transform duration-300 hover:scale-[1.02]"
          />
        </div>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
        <span>Updates automatically</span>
      </div>
    </div>
  );
});
