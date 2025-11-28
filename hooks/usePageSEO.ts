"use client";

import { useEffect } from "react";
import { updatePageTitle, seoConfigs } from "@/lib/seo";

/**
 * React hook to update the document title and SEO metadata for the current page key.
 * Uses `seoConfigs` to determine title and metadata mappings.
 * @param pageKey - The key identifying the page's SEO configuration from `seoConfigs`.
 * @returns {void}
 * @source
 */
export function usePageSEO(pageKey: keyof typeof seoConfigs) {
  useEffect(() => {
    updatePageTitle(pageKey);
  }, [pageKey]);
}
