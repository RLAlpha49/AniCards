"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { pageview } from "@/lib/utils/google-analytics";

export function useGoogleAnalytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID) {
      const queryString = searchParams.toString();
      const url = pathname + (queryString ? "?" + queryString : "");
      pageview(url);
    }
  }, [pathname, searchParams]);
}
