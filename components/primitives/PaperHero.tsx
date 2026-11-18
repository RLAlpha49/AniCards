"use client";

import type { ReactNode } from "react";
import { useRevealInView } from "@/hooks/useRevealInView";
import { cn } from "@/lib/cn";
import paper from "@/components/shared/paper.module.css";

/**
 * Where the page's own column sits, which is the one part that differs.
 *
 * `side` puts it beside the copy. `centred` also keeps it beside the copy but
 * moves the facts out of the copy, so the column can span both rows. `print`
 * centres the copy against artwork taller than itself.
 * @source
 */
export type PaperHeroAsideLayout = "side" | "centred" | "print";

type PaperHeroFact = Readonly<{ label: string; value: string }>;

type PaperHeroProps = Readonly<{
  /** Left side of the top rule: what the page is. */
  edition: string;
  /** Right side of the top rule: one fact about the page. */
  editionNote: ReactNode;
  /**
   * Drops `editionNote` on a phone. Set it when the note only decorates,
   * because the rule would otherwise clip mid-word at 560px.
   */
  editionNoteDecorative?: boolean;
  /** Vermillion kicker above the title. */
  kicker: string;
  /** Page title. Wrap the emphasised words in `em`. */
  title: ReactNode;
  /** Sentence under the title. */
  lede: ReactNode;
  /** A second line under the lede, for a note that would interrupt it. */
  ledeNote?: ReactNode;
  /** Content between the lede and the facts, such as a search field. */
  children?: ReactNode;
  /** Figures ruled off under the copy. */
  facts?: readonly PaperHeroFact[];
  /** The page's own column: artwork, a form, a list of routes. */
  aside: ReactNode;
  /** Where that column sits. Defaults to `side`. */
  asideLayout?: PaperHeroAsideLayout;
  /** Centres the hero in the viewport, for a page that is only its hero. */
  centred?: boolean;
}>;

/**
 * Hero shell shared by the paper-themed pages.
 *
 * Owns the sequence five pages repeated: the edition rule, the heavy rule under
 * it, the two-column grid, the kicker, the title, the lede, the facts, and the
 * scroll entrance on the copy. Pages supply the words and one column.
 *
 * The copy fades on scroll rather than sliding, because every one of these
 * pages puts at least one control in it. The column is rendered as given, so a
 * page that wants its own entrance keeps it.
 *
 * @param props - Shell content; see `PaperHeroProps`.
 * @source
 */
export function PaperHero({
  edition,
  editionNote,
  editionNoteDecorative = false,
  kicker,
  title,
  lede,
  ledeNote,
  children,
  facts,
  aside,
  asideLayout = "side",
  centred = false,
}: PaperHeroProps) {
  const { ref, phase } = useRevealInView<HTMLDivElement>();

  /* The centred layout keeps the facts out of the copy so the column can span
     both grid rows beside them. Every other layout lets them close the copy. */
  const factsNode = facts ? (
    <dl
      className={cn(
        paper.meta,
        asideLayout === "centred" && paper.heroFactsCentred,
      )}
    >
      {facts.map((fact) => (
        <div key={fact.label}>
          <dt>{fact.label}</dt>
          <dd>{fact.value}</dd>
        </div>
      ))}
    </dl>
  ) : null;

  return (
    <section className={cn(paper.hero, centred && paper.heroCentred)}>
      <div className={paper.sheet}>
        <p className={paper.edition}>
          <span>{edition}</span>
          <span className={paper.editionRule} aria-hidden="true" />
          <span
            className={
              editionNoteDecorative ? paper.editionNoteDecorative : undefined
            }
          >
            {editionNote}
          </span>
        </p>

        <div className={paper.heroRule} />

        <div
          className={cn(
            paper.heroInner,
            asideLayout === "centred" && paper.heroInnerCentred,
            asideLayout === "print" && paper.heroInnerPrint,
          )}
        >
          <div
            ref={ref}
            data-reveal={phase}
            className={cn(
              paper.heroCopy,
              asideLayout === "centred" && paper.heroCopyCentred,
              paper.reveal,
              paper.revealFlat,
            )}
          >
            <p className={paper.kicker}>
              <span className={paper.kickerRule} aria-hidden="true" />
              {kicker}
            </p>

            <h1 className={paper.title}>{title}</h1>

            <p className={paper.lede}>{lede}</p>

            {ledeNote && <p className={paper.ledeNote}>{ledeNote}</p>}

            {children}

            {asideLayout !== "centred" && factsNode}
          </div>

          {asideLayout === "centred" && factsNode}

          {aside}
        </div>
      </div>
    </section>
  );
}
