"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { pageview, safeTrack } from "@/lib/utils/google-analytics";

/**
 * Send pageview events to Google Analytics when the pathname or query changes.
 * Requires NEXT_PUBLIC_GOOGLE_ANALYTICS_ID to be defined at build-time.
 * @returns {void}
 * @source
 */
export function useGoogleAnalytics() {
  const pathname = usePathname();

  // Omit query parameters so usernames and other identifiers stay out of GA.
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID) {
      safeTrack(() => pageview(pathname));
    }
  }, [pathname]);
}
