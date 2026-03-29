"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type CopyFormat = "url" | "anilist" | "failed-list";

export function useCopyFeedback(previewUrl: string | null) {
  const [copiedFormat, setCopiedFormat] = useState<CopyFormat | null>(null);
  const [error, setError] = useState<string | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const handleCopy = useCallback(
    async (format: CopyFormat = "url") => {
      if (!previewUrl) return;
      try {
        setError(null);
        const resolvedUrl = new URL(
          previewUrl,
          globalThis.location.origin,
        ).toString();
        const textToCopy =
          format === "anilist" ? `img200(${resolvedUrl})` : resolvedUrl;
        await navigator.clipboard.writeText(textToCopy);
        setCopiedFormat(format);
        if (copyTimerRef.current) {
          clearTimeout(copyTimerRef.current);
        }
        copyTimerRef.current = setTimeout(() => setCopiedFormat(null), 2000);
      } catch (error) {
        setError("Failed to copy to clipboard");
        console.error("Failed to copy to clipboard:", error);
      }
    },
    [previewUrl],
  );

  return { copiedFormat, handleCopy, setCopiedFormat, error } as const;
}
