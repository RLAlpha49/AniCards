"use client";

import { useEffect, useRef, useState } from "react";

import { logPrivacySafe } from "@/lib/api/logging";
import {
  extractStructuredErrorContext,
  type StructuredErrorLike,
} from "@/lib/error-messages";
import { reportStructuredError } from "@/lib/error-tracking";
import { safeTrack, trackError } from "@/lib/utils/google-analytics";

type AppRouterBoundaryError = StructuredErrorLike & { digest?: string };

interface AppRouterErrorBoundaryReportingOptions {
  error: AppRouterBoundaryError;
  boundary: string;
  defaultErrorName: string;
  logLabel: string;
  userAction: string;
}

interface AppRouterErrorBoundaryReportingResult {
  incidentReference?: string;
}

function getCurrentRoute(): string | undefined {
  if (globalThis.location === undefined) {
    return undefined;
  }

  return `${globalThis.location.pathname}${globalThis.location.search}`;
}

export function useAppRouterErrorBoundaryReporting(
  props: Readonly<AppRouterErrorBoundaryReportingOptions>,
): AppRouterErrorBoundaryReportingResult {
  const { boundary, defaultErrorName, error, logLabel, userAction } = props;
  const [incidentReference, setIncidentReference] = useState<string>();
  const pendingIncidentErrorRef = useRef<AppRouterBoundaryError | null>(null);

  useEffect(() => {
    const currentRoute = getCurrentRoute();
    const errorContext = extractStructuredErrorContext(
      error,
      "We couldn't render this part of the experience.",
    );
    const fallbackIncidentReference = error.digest?.trim() || undefined;
    let isActive = true;

    pendingIncidentErrorRef.current = error;
    setIncidentReference(undefined);

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
      errorName: error.name ?? defaultErrorName,
      category: errorContext.category,
      retryable: errorContext.retryable,
      recoverySuggestions: errorContext.recoverySuggestions,
      statusCode: errorContext.statusCode,
      digest: error.digest,
      route: currentRoute,
      metadata: {
        boundary,
      },
    }).then((report) => {
      if (!isActive || pendingIncidentErrorRef.current !== error) {
        return;
      }

      setIncidentReference(report?.id ?? fallbackIncidentReference);
    });

    safeTrack(() =>
      trackError(error.name ?? defaultErrorName, error.message ?? undefined),
    );

    return () => {
      isActive = false;

      if (pendingIncidentErrorRef.current === error) {
        pendingIncidentErrorRef.current = null;
      }
    };
  }, [boundary, defaultErrorName, error, logLabel, userAction]);

  return { incidentReference };
}
