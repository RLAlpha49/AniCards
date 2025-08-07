import { Label } from "@/components/ui/label";
import React from "react";

interface LivePreviewProps {
  previewSVG: string;
}

export const LivePreview = React.memo(function LivePreview({
  previewSVG,
}: LivePreviewProps) {
  return (
    <div className="space-y-2">
      <Label>Live Preview</Label>
      <div className="flex justify-center rounded-lg border p-4 backdrop-blur-sm">
        <div dangerouslySetInnerHTML={{ __html: previewSVG }} />
      </div>
      <p className="text-xs text-gray-600 dark:text-gray-400">
        Preview updates automatically with color changes
      </p>
    </div>
  );
});
