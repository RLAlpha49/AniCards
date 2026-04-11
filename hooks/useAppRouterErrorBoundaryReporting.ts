"use client";

import { useEffect } from "react";

import { logPrivacySafe } from "@/lib/api/logging";
import { reportStructuredError } from "@/lib/error-tracking";
import { safeTrack, trackError } from "@/lib/utils/google-analytics";

interface AppRouterErrorBoundaryReportingOptions {
  error: Error & { digest?: string };
  boundary: string;
  defaultErrorName: string;
  logLabel: string;
  userAction: string;
}

function getCurrentRoute(): string | undefined {
  if (globalThis.location === undefined) {
    return undefined;
  }

  return `${globalThis.location.pathname}${globalThis.location.search}`;
}

export function useAppRouterErrorBoundaryReporting(
  props: Readonly<AppRouterErrorBoundaryReportingOptions>,
) {
  const { boundary, defaultErrorName, error, logLabel, userAction } = props;

  useEffect(() => {
    const currentRoute = getCurrentRoute();

    logPrivacySafe(
      "error",
      "AppRouterErrorBoundary",
      "App Router error boundary caught route error",
      {
        boundary,
        errorName: error.name ?? defaultErrorName,
        error: error.message,
        digest: error.digest,
        route: currentRoute,
        stack: error.stack,
      },
    );

    if (process.env.NODE_ENV === "development") {
      console.error(logLabel, error);
    }

    void reportStructuredError({
      source: "app_router_error_boundary",
      userAction,
      error,
      digest: error.digest,
      route: currentRoute,
      metadata: {
        boundary,
      },
    });

    safeTrack(() =>
      trackError(error.name ?? defaultErrorName, error.message ?? undefined),
    );
  }, [boundary, defaultErrorName, error, logLabel, userAction]);
}
