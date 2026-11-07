import styles from "./home.module.css";

type SectionHeadingProps = Readonly<{
  /** Decorative numeral shown beside the heading. */
  numeral: string;
  title: string;
  note: string;
}>;

/**
 * Numbered section heading used by the home page.
 *
 * @param props.numeral - Decorative numeral rendered in vermillion.
 * @param props.title - Section title.
 * @param props.note - One-line description shown under the title.
 * @source
 */
export function SectionHeading({ numeral, title, note }: SectionHeadingProps) {
  return (
    <header className={styles.sectionHead}>
      <span className={styles.sectionNum} aria-hidden="true">
        {numeral}
      </span>
      <div>
        <h2>{title}</h2>
        <p>{note}</p>
      </div>
    </header>
  );
}
