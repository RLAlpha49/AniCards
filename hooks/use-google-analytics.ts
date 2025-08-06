"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { pageview } from "@/lib/utils/google-analytics";

export function useGoogleAnalytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID) {
      const url = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
      pageview(url);
    }
  }, [pathname, searchParams]);
}
