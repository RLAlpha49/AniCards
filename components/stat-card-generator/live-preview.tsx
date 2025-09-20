import React from "react";

interface LivePreviewProps {
  previewSVG: string;
}

export const LivePreview = React.memo(function LivePreview({
  previewSVG,
}: LivePreviewProps) {
  return (
    <div className="flex flex-col items-center space-y-3">
      <div className="flex max-w-[500px] justify-center rounded-xl border border-green-100/50 bg-gradient-to-br from-white to-gray-50 p-6 shadow-inner dark:border-green-900/30 dark:from-gray-800 dark:to-gray-900">
        <div
          dangerouslySetInnerHTML={{ __html: previewSVG }}
          className="transition-all duration-300 hover:scale-105"
        />
      </div>
      <p className="text-center text-xs text-gray-500 dark:text-gray-400">
        ✨ Updates automatically as you change colors
      </p>
    </div>
  );
});
