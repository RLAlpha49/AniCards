"use client";

import "./globals.css";

import { ErrorFallbackPanel } from "@/components/ErrorBoundary";
import { useAppRouterErrorBoundaryReporting } from "@/hooks/useAppRouterErrorBoundaryReporting";

export default function GlobalError({
  error,
  reset,
}: Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>) {
  const { debugRoute, incidentReference, incidentStatus } =
    useAppRouterErrorBoundaryReporting({
      error,
      boundary: "app_global_error",
      defaultErrorName: "AppGlobalError",
      logLabel: "[GlobalErrorBoundary] Caught application error:",
      userAction: "render_root_layout",
    });

  return (
    <html lang="en">
      <title>AniCards | Application Error</title>
      <body id="app-root" className="antialiased">
        <ErrorFallbackPanel
          debugRoute={debugRoute}
          error={error}
          digest={error.digest}
          incidentReference={incidentReference}
          incidentStatus={incidentStatus}
          homeHref="/"
          onRetry={reset}
          retryLabel="Try Again"
        />
      </body>
    </html>
  );
}
