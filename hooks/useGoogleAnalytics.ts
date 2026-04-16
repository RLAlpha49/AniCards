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
    if (!consentGranted) return;

    const preconditionFailureReason = !process.env
      .NEXT_PUBLIC_GOOGLE_ANALYTICS_ID
      ? "measurement_id_missing"
      : !hasAnalyticsConsent()
        ? "consent_not_granted"
        : !isAnalyticsBootstrapReady()
          ? "bootstrap_not_ready"
          : undefined;

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
