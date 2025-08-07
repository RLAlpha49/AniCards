"use client";

import { useEffect } from "react";
import { updatePageTitle, seoConfigs } from "@/lib/seo";

export function usePageSEO(pageKey: keyof typeof seoConfigs) {
  useEffect(() => {
    updatePageTitle(pageKey);
  }, [pageKey]);
}
