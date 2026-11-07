import styles from "./home.module.css";

type SectionHeadingProps = Readonly<{
  numeral: string;
  title: string;
  note: string;
  id?: string;
}>;

/**
 * Numbered section heading used by the home page.
 *
 * @param props.numeral - Decorative numeral rendered in vermillion.
 * @param props.title - Section title.
 * @param props.note - One-line description shown under the title.
 * @param props.id - Optional id for the heading, for `aria-labelledby`.
 * @source
 */
export function SectionHeading({
  numeral,
  title,
  note,
  id,
}: SectionHeadingProps) {
  return (
    <header className={styles.sectionHead}>
      <span className={styles.sectionNum} aria-hidden="true">
        {numeral}
      </span>
      <div>
        <h2 id={id}>{title}</h2>
        <p>{note}</p>
      </div>
    </header>
  );
}
