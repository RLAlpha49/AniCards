"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { pageview } from "@/lib/utils/google-analytics";

/**
 * Send pageview events to Google Analytics when the pathname or query changes.
 * Requires NEXT_PUBLIC_GOOGLE_ANALYTICS_ID to be defined at build-time.
 * @returns {void}
 * @source
 */
export function useGoogleAnalytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Record pageview when the pathname or query changes
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID) {
      const queryString = searchParams.toString();
      const url = pathname + (queryString ? "?" + queryString : "");
      pageview(url);
    }
  }, [pathname, searchParams]);
}
