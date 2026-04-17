"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

import {
  hasAnalyticsConsent,
  isAnalyticsBootstrapReady,
  normalizeAnalyticsPage,
  pageview,
  reportAnalyticsPreconditionFailure,
  safeTrack,
} from "@/lib/utils/google-analytics";

function getAnalyticsPreconditionFailureReason():
  | "bootstrap_not_ready"
  | "consent_not_granted"
  | "measurement_id_missing"
  | null {
  if (process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID === undefined) {
    return "measurement_id_missing";
  }

  if (hasAnalyticsConsent()) {
    if (isAnalyticsBootstrapReady()) {
      return null;
    }

    return "bootstrap_not_ready";
  }

  return "consent_not_granted";
}

/**
 * Send pageview events to Google Analytics when the pathname or query changes.
 * Requires NEXT_PUBLIC_GOOGLE_ANALYTICS_ID to be defined at build-time.
 * @returns {void}
 * @source
 */
export function useGoogleAnalytics(consentGranted: boolean) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const normalizedPage = normalizeAnalyticsPage({
    pathname,
    search: queryString,
  });
  const normalizedPagePath = normalizedPage.pagePath;
  const normalizedPageTitle = normalizedPage.pageTitle;

  useEffect(() => {
    if (consentGranted === false) return;

    const preconditionFailureReason = getAnalyticsPreconditionFailureReason();

    if (preconditionFailureReason) {
      void reportAnalyticsPreconditionFailure({
        userAction: "analytics_pageview_dispatch",
        reason: preconditionFailureReason,
        metadata: {
          analyticsHook: "use_google_analytics",
          pagePath: normalizedPagePath,
          pageTitle: normalizedPageTitle,
        },
      });
      return;
    }

    safeTrack(
      () =>
        pageview({
          pathname,
          search: queryString,
          metadata: {
            analyticsHook: "use_google_analytics",
          },
        }),
      {
        userAction: "analytics_pageview_dispatch",
        metadata: {
          analyticsHook: "use_google_analytics",
          pagePath: normalizedPagePath,
        },
      },
    );
  }, [
    consentGranted,
    normalizedPagePath,
    normalizedPageTitle,
    pathname,
    queryString,
  ]);
}
