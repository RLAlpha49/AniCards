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
  const { incidentReference } = useAppRouterErrorBoundaryReporting({
    error,
    boundary: "app_root_error",
    defaultErrorName: "AppRouteError",
    logLabel: "[AppErrorBoundary] Caught route error:",
    userAction: "route_segment_render",
  });

  return (
    <ErrorFallbackPanel
      error={error}
      onRetry={reset}
      retryLabel="Try Again"
      digest={error.digest}
      incidentReference={incidentReference}
    />
  );
}
