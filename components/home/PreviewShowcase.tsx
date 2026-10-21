"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight } from "@/lib/icons";
import { useRevealInView } from "@/hooks/useRevealInView";
import { cn } from "@/lib/utils";
import { CardPreviewImage } from "@/components/CardPreviewImage";
import { SectionHeading } from "./SectionHeading";
import {
  CARDS_PER_PAGE,
  SHOWCASE_FILTERS,
  SHOWCASE_CARDS,
  type ShowcaseCategory,
} from "./showcase";
import styles from "./home.module.css";

type PreviewShowcaseProps = Readonly<{
  onGetStarted: () => void;
}>;

/**
 * Card gallery for the home page.
 *
 * Keeps the filter tabs and paging from the original showcase, restyled as a
 * numbered set. The section id stays `preview-showcase` so the "View
 * examples" action and the existing end-to-end test still resolve it.
 *
 * @param props.onGetStarted - Opens the generator from a card.
 * @source
 */
export function PreviewShowcase({ onGetStarted }: PreviewShowcaseProps) {
  const [activeCategory, setActiveCategory] = useState<
    "all" | ShowcaseCategory
  >("all");
  const [page, setPage] = useState(0);
  const { ref: revealRef, phase } = useRevealInView<HTMLUListElement>();

  const filtered = useMemo(
    () =>
      activeCategory === "all"
        ? SHOWCASE_CARDS
        : SHOWCASE_CARDS.filter((card) => card.category === activeCategory),
    [activeCategory],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / CARDS_PER_PAGE));
  const visible = filtered.slice(
    page * CARDS_PER_PAGE,
    (page + 1) * CARDS_PER_PAGE,
  );

  /* The footer sentence describes what the gallery actually shows: the
     range of cards on the current page, out of the catalogue total. */
  const firstShown = page * CARDS_PER_PAGE + 1;
  const lastShown = page * CARDS_PER_PAGE + visible.length;

  const selectCategory = (category: "all" | ShowcaseCategory) => {
    setActiveCategory(category);
    setPage(0);
  };

  return (
    <section id="preview-showcase" className={styles.collection}>
      <div className={styles.sheet}>
        <SectionHeading
          numeral="壱"
          title="Card gallery"
          note="Each preview is generated live from the same public AniList profile."
        />

        <div className={styles.filters} role="group" aria-label="Filter cards">
          {SHOWCASE_FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => selectCategory(filter.id)}
              aria-pressed={activeCategory === filter.id}
              className={cn(
                styles.filter,
                activeCategory === filter.id && styles.filterActive,
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <ul
          ref={revealRef}
          data-reveal={phase}
          className={cn(styles.gallery, styles.reveal)}
        >
          {visible.map((card, index) => (
            <li key={card.cardType + card.variation} className={styles.plate}>
              <figure className={styles.plateFigure}>
                <div className={styles.plateFrame}>
                  <CardPreviewImage
                    cardType={card.cardType}
                    variation={card.variation}
                    alt={`${card.title} card preview`}
                    className={styles.plateImage}
                  />
                </div>
                <figcaption className={styles.cartouche}>
                  <span className={styles.plateIndex}>
                    {String(page * CARDS_PER_PAGE + index + 1).padStart(2, "0")}
                  </span>
                  <span className={styles.plateTitle}>{card.title}</span>
                  <span className={styles.plateNote}>{card.note}</span>
                  <button
                    type="button"
                    onClick={onGetStarted}
                    className={styles.plateAction}
                  >
                    Create this card
                    <ArrowRight
                      className={styles.plateActionIcon}
                      aria-hidden="true"
                    />
                  </button>
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>

        {totalPages > 1 && (
          <nav className={styles.pager} aria-label="Gallery pages">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(0, current - 1))}
              disabled={page === 0}
              className={styles.pagerButton}
              aria-label="Previous page"
            >
              <ChevronLeft />
            </button>

            <div className={styles.pagerPages}>
              {Array.from({ length: totalPages }, (_, index) => (
                <button
                  key={`gallery-page-${index}`}
                  type="button"
                  onClick={() => setPage(index)}
                  aria-current={page === index ? "page" : undefined}
                  className={cn(
                    styles.pagerPage,
                    page === index && styles.pagerPageActive,
                  )}
                >
                  {index + 1}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() =>
                setPage((current) => Math.min(totalPages - 1, current + 1))
              }
              disabled={page === totalPages - 1}
              className={styles.pagerButton}
              aria-label="Next page"
            >
              <ChevronRight />
            </button>
          </nav>
        )}

        <p className={styles.galleryFoot}>
          Showing {firstShown}–{lastShown} of {SHOWCASE_CARDS.length} curated
          cards, drawn from fifty-four card types.{" "}
          <Link href="/examples" className={styles.inlineLink}>
            Browse all card types
          </Link>
        </p>
      </div>
    </section>
  );
}
