"use client";

import { useRevealInView } from "@/hooks/useRevealInView";
import { cn } from "@/lib/utils";
import homeStyles from "@/components/home/home.module.css";
import styles from "./card-examples.module.css";
import { CardTypePreview } from "./CardTypePreview";
import { groupAnchor, type CardType, type GroupName } from "./card-types";

type GroupSectionProps = Readonly<{
  group: GroupName;
  numeral: string;
  note: string;
  cardTypes: CardType[];
  onOpenGenerator: () => void;
}>;

/**
 * One group of card types.
 *
 * The section keeps a stable anchor so the group navigation can jump to it,
 * and it renders nothing when the search leaves the group empty.
 *
 * @param props.group - Group name, matching the generator's own labels.
 * @param props.numeral - Kanji numeral shown beside the heading.
 * @param props.note - One line describing what the group covers.
 * @param props.cardTypes - Matching card types in this group.
 * @param props.onOpenGenerator - Opens the stat card generator.
 * @source
 */
export function GroupSection({
  group,
  numeral,
  note,
  cardTypes,
  onOpenGenerator,
}: GroupSectionProps) {
  const { ref, phase } = useRevealInView<HTMLUListElement>();

  if (cardTypes.length === 0) return null;

  const variationCount = cardTypes.reduce(
    (total, cardType) => total + cardType.variations.length,
    0,
  );

  return (
    <section id={groupAnchor(group)} className={styles.group}>
      <header className={styles.groupHead}>
        <div>
          <div className={styles.groupTitle}>
            <span className={styles.groupNumeral} aria-hidden="true">
              {numeral}
            </span>
            <h2>{group}</h2>
          </div>
          <p className={styles.groupNote}>{note}</p>
        </div>

        <p className={styles.groupCount}>
          {cardTypes.length} card type{cardTypes.length === 1 ? "" : "s"} ·{" "}
          {variationCount} variation{variationCount === 1 ? "" : "s"}
        </p>
      </header>

      <ul
        ref={ref}
        data-reveal={phase}
        className={cn(styles.cards, homeStyles.reveal, homeStyles.revealFlat)}
      >
        {cardTypes.map((cardType, index) => (
          <li key={cardType.title}>
            <CardTypePreview
              cardType={cardType}
              index={index}
              onOpenGenerator={onOpenGenerator}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
