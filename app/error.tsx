"use client";

import { useEffect } from "react";

import { ErrorFallbackPanel } from "@/components/ErrorBoundary";
import { reportStructuredError } from "@/lib/error-tracking";
import { safeTrack, trackError } from "@/lib/utils/google-analytics";

export default function AppErrorBoundary({
  error,
  reset,
}: Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>) {
  useEffect(() => {
    console.error("[AppErrorBoundary] Caught route error:", error);

    void reportStructuredError({
      source: "app_router_error_boundary",
      userAction: "route_segment_render",
      error,
      digest: error.digest,
      route:
        globalThis.location === undefined
          ? undefined
          : `${globalThis.location.pathname}${globalThis.location.search}`,
      metadata: {
        boundary: "app_root_error",
      },
    });

    safeTrack(() =>
      trackError(error.name ?? "AppRouteError", error.message ?? undefined),
    );
  }, [error]);

  return (
    <ErrorFallbackPanel
      error={error}
      onRetry={reset}
      retryLabel="Try Again"
      digest={error.digest}
      incidentReference={error.digest}
    />
  );
}
