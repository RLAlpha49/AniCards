"use client";

import { useState } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PaperSurface } from "@/components/PaperSurface";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { usePageSEO } from "@/hooks/usePageSEO";
import { SearchHero } from "@/components/search/SearchHero";
import styles from "@/components/search/search.module.css";

/**
 * The saved cards page.
 *
 * AniCards keeps every card a visitor generates. This page is the way back to
 * it: one field that takes a handle or a numeric ID and opens the cards already
 * saved for that profile, so nobody has to walk the generator again to reach
 * something they made earlier.
 *
 * The hero is the whole page. The field is the only thing to do here, so there
 * is no second section competing with it.
 * @source
 */
export default function UserSearchPage() {
  usePageSEO("search");

  const [loading, setLoading] = useState(false);

  return (
    <ErrorBoundary
      resetKeys={[loading ? "loading" : "idle"]}
      onReset={() => setLoading(false)}
    >
      <PaperSurface>
        <SearchHero onLoadingChange={setLoading} />

        {loading && (
          <div className={styles.overlay} role="status" aria-live="polite">
            <div className={styles.overlayCard}>
              <LoadingSpinner size="lg" text="Finding your cards..." />
              <p className={styles.overlayNote}>
                Reading the cards saved for that profile.
              </p>
            </div>
          </div>
        )}
      </PaperSurface>
    </ErrorBoundary>
  );
}
