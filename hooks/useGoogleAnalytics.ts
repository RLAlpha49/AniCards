"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

import {
  normalizeAnalyticsPage,
  pageview,
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
  const normalizedPagePath = normalizeAnalyticsPage({
    pathname,
    search: queryString,
  }).pagePath;

  useEffect(() => {
    if (!consentGranted || !process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID) return;

    safeTrack(
      () =>
        pageview({
          pathname,
          search: queryString,
        }),
      {
        userAction: "analytics_pageview_dispatch",
        metadata: {
          analyticsHook: "use_google_analytics",
          pagePath: normalizedPagePath,
        },
      },
    );
  }, [consentGranted, normalizedPagePath, pathname, queryString]);
}
