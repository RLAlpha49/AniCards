"use client";

import { ErrorFallbackPanel } from "@/components/ErrorBoundary";
import { useAppRouterErrorBoundaryReporting } from "@/hooks/useAppRouterErrorBoundaryReporting";

export default function AppErrorBoundary({
  error,
  reset,
}: Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>) {
  const { debugRoute, incidentReference, incidentStatus } =
    useAppRouterErrorBoundaryReporting({
      error,
      boundary: "app_root_error",
      defaultErrorName: "AppRouteError",
      logLabel: "[AppErrorBoundary] Caught route error:",
      userAction: "route_segment_render",
    });

  return (
    <ErrorFallbackPanel
      debugRoute={debugRoute}
      error={error}
      digest={error.digest}
      incidentReference={incidentReference}
      incidentStatus={incidentStatus}
      onRetry={reset}
      retryLabel="Try Again"
    />
  );
}
