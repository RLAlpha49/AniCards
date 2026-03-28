"use client";

import "./globals.css";

import { useEffect } from "react";

import { ErrorFallbackPanel } from "@/components/ErrorBoundary";
import { reportStructuredError } from "@/lib/error-tracking";
import { safeTrack, trackError } from "@/lib/utils/google-analytics";

export default function GlobalError({
  error,
  reset,
}: Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>) {
  useEffect(() => {
    console.error("[GlobalErrorBoundary] Caught application error:", error);

    void reportStructuredError({
      source: "app_router_error_boundary",
      userAction: "render_root_layout",
      error,
      digest: error.digest,
      route:
        globalThis.location === undefined
          ? undefined
          : `${globalThis.location.pathname}${globalThis.location.search}`,
      metadata: {
        boundary: "app_global_error",
      },
    });

    safeTrack(() =>
      trackError(error.name ?? "AppGlobalError", error.message ?? undefined),
    );
  }, [error]);

  return (
    <html lang="en">
      <title>AniCards | Application Error</title>
      <body id="app-root" className="antialiased">
        <ErrorFallbackPanel
          error={error}
          onRetry={reset}
          retryLabel="Try Again"
          digest={error.digest}
          homeHref="/"
        />
      </body>
    </html>
  );
}
