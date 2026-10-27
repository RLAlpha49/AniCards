"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronUp } from "@/lib/icons";
import { useRevealInView } from "@/hooks/useRevealInView";
import { cn } from "@/lib/utils";
import { safeTrack, trackButtonClick } from "@/lib/utils/google-analytics";
import styles from "./PageCta.module.css";

/**
 * One action inside the closing block.
 *
 * `href` renders a Next link, `hrefExternal` renders a new-tab anchor, and no
 * address renders a button. `onClick` still runs for every shape, so pages keep
 * their own analytics.
 * @source
 */
export type PageCtaAction = Readonly<{
  label: string;
  href?: string;
  hrefExternal?: string;
  onClick?: () => void;
  icon?: ReactNode;
  /** Degrees to rotate the icon, for arrows that point the other way. */
  iconRotate?: number;
}>;

type PageCtaProps = Readonly<{
  /** Vermillion seal kanji above the heading. */
  seal: string;
  /** Heading. Wrap the emphasised words in `em`. */
  title: ReactNode;
  /** Sentence under the heading. */
  children: ReactNode;
  primary: PageCtaAction;
  secondary?: PageCtaAction;
  /** Small print under the back-to-top action. */
  fine?: ReactNode;
  /** Shows the back-to-top action. Defaults to true. */
  backToTop?: boolean;
  /** Analytics name for the back-to-top click. */
  backToTopLabel?: string;
  className?: string;
}>;

/**
 * Closing call to action shared by the paper pages.
 *
 * Owns the framing every page repeated: the section padding, the sheet width,
 * the bordered box with its hairline rule, the seal, the button pair, the
 * back-to-top action, and the reveal entrance. Pages supply the words.
 *
 * @param props.seal - Kanji pressed into the seal.
 * @param props.title - Heading content.
 * @param props.children - Body sentence.
 * @param props.primary - Main action.
 * @param props.secondary - Optional second action.
 * @param props.fine - Small print.
 * @param props.backToTop - Whether to show the back-to-top action.
 * @param props.backToTopLabel - Analytics name for that action.
 * @param props.className - Extra classes for the section.
 * @source
 */
export function PageCta({
  seal,
  title,
  children,
  primary,
  secondary,
  fine,
  backToTop = true,
  backToTopLabel = "back_to_top",
  className,
}: PageCtaProps) {
  const { ref, phase } = useRevealInView<HTMLDivElement>();

  const scrollToTop = () => {
    safeTrack(() => trackButtonClick(backToTopLabel));
    globalThis.scrollTo({ top: 0, behavior: "smooth" });
  };

  const renderAction = (
    action: PageCtaAction,
    kind: "primary" | "secondary",
  ) => {
    const classNames = kind === "primary" ? styles.primary : styles.secondary;
    const icon = action.icon ? (
      <span
        className={
          kind === "primary" ? styles.primaryIcon : styles.secondaryIcon
        }
        style={
          action.iconRotate ? { rotate: `${action.iconRotate}deg` } : undefined
        }
        aria-hidden="true"
      >
        {action.icon}
      </span>
    ) : null;
    const content = (
      <>
        {action.label}
        {icon}
      </>
    );

    if (action.hrefExternal) {
      return (
        <a
          href={action.hrefExternal}
          target="_blank"
          rel="noopener noreferrer"
          className={classNames}
          onClick={action.onClick}
        >
          {content}
        </a>
      );
    }

    if (action.href) {
      return (
        <Link
          href={action.href}
          className={classNames}
          onClick={action.onClick}
        >
          {content}
        </Link>
      );
    }

    return (
      <button type="button" onClick={action.onClick} className={classNames}>
        {content}
      </button>
    );
  };

  return (
    <section className={cn(styles.section, className)}>
      <div className={styles.sheet}>
        <div ref={ref} data-reveal={phase} className={styles.cta}>
          <span className={styles.seal} aria-hidden="true">
            {seal}
          </span>
          <h2>{title}</h2>
          <p>{children}</p>

          <div className={styles.actions}>
            {renderAction(primary, "primary")}
            {secondary ? renderAction(secondary, "secondary") : null}
          </div>

          {backToTop ? (
            <button type="button" onClick={scrollToTop} className={styles.top}>
              Back to the top
              <ChevronUp className={styles.topIcon} aria-hidden="true" />
            </button>
          ) : null}

          {fine ? <p className={styles.fine}>{fine}</p> : null}
        </div>
      </div>
    </section>
  );
}
