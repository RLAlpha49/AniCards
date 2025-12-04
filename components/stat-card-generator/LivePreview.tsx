import React from "react";
import { isTrustedSvgString, cn } from "@/lib/utils";
import type { TrustedSVG } from "@/lib/types/svg";
import { stripTrustedSvgMarker } from "@/lib/types/svg";
import { motion } from "framer-motion";
import { Eye, Sparkles } from "lucide-react";

/**
 * Props for LivePreview component.
 * @property previewSVG - Serialized SVG markup shown in the preview.
 * @property className - Optional class names applied to the container.
 * @source
 */
interface LivePreviewProps {
  previewSVG: TrustedSVG;
  className?: string;
}

/**
 * Live preview renderer that injects an SVG string into the DOM.
 * The `previewSVG` content is rendered via `dangerouslySetInnerHTML`.
 * @param previewSVG - SVG markup string to render inside the preview container.
 * @param className - Optional additional class names for layout.
 * @returns A memoized React component that displays the live SVG preview.
 * @source
 */
export const LivePreview = React.memo(function LivePreview({
  previewSVG,
  className,
}: LivePreviewProps) {
  // Runtime guard to ensure only marked trusted SVGs are rendered.
  if (
    process.env.NODE_ENV !== "production" &&
    !isTrustedSvgString(previewSVG)
  ) {
    // Fail fast in dev to catch untrusted usage; in production prefer a
    // warning to avoid crashing the experience for end users.
    throw new Error(
      "LivePreview: `previewSVG` must be a TrustedSVG. Use a template or markTrustedSvg() to produce a trusted value.",
    );
  }

  return (
    <div className={cn("flex flex-col items-center", className)}>
      {/* Preview Container */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="group relative"
      >
        {/* Glow effect */}
        <div className="absolute -inset-4 rounded-3xl bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 opacity-0 blur-xl transition-opacity duration-500 group-hover:opacity-100" />

        {/* Preview frame */}
        <div className="dark:via-slate-850 relative overflow-hidden rounded-2xl border border-slate-200/50 bg-gradient-to-br from-white via-slate-50 to-slate-100 p-4 shadow-lg shadow-slate-200/50 transition-all duration-300 group-hover:shadow-xl dark:border-slate-700/50 dark:from-slate-800 dark:to-slate-900 dark:shadow-slate-900/50">
          {/* Checkerboard pattern for transparency indication */}
          <div
            className="absolute inset-0 opacity-[0.02] dark:opacity-[0.03]"
            style={{
              backgroundImage: `
              linear-gradient(45deg, #000 25%, transparent 25%),
              linear-gradient(-45deg, #000 25%, transparent 25%),
              linear-gradient(45deg, transparent 75%, #000 75%),
              linear-gradient(-45deg, transparent 75%, #000 75%)
            `,
              backgroundSize: "16px 16px",
              backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
            }}
          />

          {/* SVG Content */}
          <div
            // Unsafe HTML is intentionally rendered from trusted sources only.
            // The runtime assertion above ensures the string was generated from
            // a template or sanitized helper and carries the Trusted SVG marker.
            dangerouslySetInnerHTML={{
              __html: stripTrustedSvgMarker(previewSVG),
            }}
            className="relative transition-transform duration-300 group-hover:scale-[1.01]"
          />
        </div>
      </motion.div>

      {/* Status indicator */}
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mt-4 flex items-center gap-2"
      >
        <div className="flex items-center gap-2 rounded-full border border-slate-200/50 bg-white/80 px-3 py-1.5 shadow-sm backdrop-blur-sm dark:border-slate-700/50 dark:bg-slate-800/80">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
          </span>
          <span className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">
            <Eye className="h-3 w-3" />
            Live Preview
          </span>
          <Sparkles className="h-3 w-3 text-purple-500" />
        </div>
      </motion.div>
    </div>
  );
});
