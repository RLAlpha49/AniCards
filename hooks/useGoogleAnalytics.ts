"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { pageview, safeTrack } from "@/lib/utils/google-analytics";

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

  useEffect(() => {
    if (!consentGranted || !process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID) return;

    safeTrack(() =>
      pageview({
        pathname,
        search: queryString,
      }),
    );
  }, [consentGranted, pathname, queryString]);
}
