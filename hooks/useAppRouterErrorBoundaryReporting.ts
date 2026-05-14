"use client";

import { useEffect, useRef, useState } from "react";

import { logPrivacySafe } from "@/lib/api/logging";
import {
  extractStructuredErrorContext,
  type StructuredErrorLike,
} from "@/lib/error-messages";
import { sanitizeErrorReportRoute } from "@/lib/error-report-sanitization";
import {
  type ErrorReportDurabilityStatus,
  getImmediateIncidentReference,
  reportStructuredError,
} from "@/lib/error-tracking";
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
  debugRoute?: string;
  incidentReference?: string;
  incidentStatus: ErrorReportDurabilityStatus;
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
  const [incidentStatus, setIncidentStatus] =
    useState<ErrorReportDurabilityStatus>("unconfirmed");
  const pendingIncidentErrorRef = useRef<AppRouterBoundaryError | null>(null);
  const immediateIncidentReferenceRef = useRef<{
    error: AppRouterBoundaryError | null;
    incidentReference: string;
  }>({
    error: null,
    incidentReference: getImmediateIncidentReference(),
  });

  if (immediateIncidentReferenceRef.current.error !== error) {
    immediateIncidentReferenceRef.current = {
      error,
      incidentReference: getImmediateIncidentReference(error.digest),
    };
  }

  const immediateIncidentReference =
    immediateIncidentReferenceRef.current.incidentReference;

  useEffect(() => {
    const currentRoute = getCurrentRoute();
    const errorContext = extractStructuredErrorContext(
      error,
      "We couldn't render this part of the experience.",
    );
    let isActive = true;

    pendingIncidentErrorRef.current = error;
    setIncidentStatus("unconfirmed");

    logPrivacySafe(
      "error",
      "AppRouterErrorBoundary",
      "App Router error boundary caught route error",
      {
        boundary,
        errorName: error.name ?? defaultErrorName,
        error: error.message,
        digest: error.digest,
        incidentReference: immediateIncidentReference,
        route: currentRoute,
        stack: error.stack,
      },
    );

    if (process.env.NODE_ENV === "development") {
      console.error(logLabel, error);
    }

    void reportStructuredError({
      id: immediateIncidentReference,
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
        initialIncidentReference: immediateIncidentReference,
      },
    }).then((report) => {
      if (!isActive || pendingIncidentErrorRef.current !== error) {
        return;
      }

      setIncidentStatus(report?.durableStatus ?? "unconfirmed");
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
  }, [
    boundary,
    defaultErrorName,
    error,
    immediateIncidentReference,
    logLabel,
    userAction,
  ]);

  return {
    debugRoute: sanitizeErrorReportRoute(getCurrentRoute()),
    incidentReference: immediateIncidentReference,
    incidentStatus,
  };
}
