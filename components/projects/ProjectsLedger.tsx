"use client";

import { useRevealInView } from "@/hooks/useRevealInView";
import { cn } from "@/lib/utils";
import homeStyles from "@/components/home/home.module.css";
import { FLOW_ROWS } from "./catalogue";
import styles from "./projects.module.css";

/**
 * The data each tool reads and writes, set as a ledger.
 *
 * Sits directly under the hero, before the entries. It answers the question the
 * entries take several screens to answer: which of these tools touches my
 * account, and which one only reads it. A visitor can rule a tool out here
 * without scrolling past it.
 * @source
 */
export function ProjectsLedger() {
  const { ref, phase } = useRevealInView<HTMLDivElement>();

  return (
    <section className={styles.ledgerSection} aria-labelledby="ledger-title">
      <div className={styles.sheet}>
        <header className={styles.ledgerHead}>
          <h2 id="ledger-title" className={styles.ledgerTitle}>
            What each one reads and writes
          </h2>
          <p className={styles.ledgerNote}>
            All three read from AniList. Only two write back to your account.
          </p>
        </header>

        <div
          ref={ref}
          data-reveal={phase}
          className={cn(styles.ledger, homeStyles.reveal)}
        >
          <p className={styles.ledgerColumns} aria-hidden="true">
            <span>Tool</span>
            <span>Reads</span>
            <span>Writes</span>
          </p>

          <ul className={styles.ledgerList}>
            {FLOW_ROWS.map((row) => (
              <li key={row.tool} className={styles.ledgerRow}>
                <p className={styles.ledgerTool}>
                  <span className={styles.ledgerNum} aria-hidden="true">
                    {row.numeral}
                  </span>
                  {row.tool}
                </p>
                <p className={styles.ledgerCell}>
                  <span className={styles.ledgerCellLabel}>Reads</span>
                  <span className={styles.ledgerCellValue}>{row.reads}</span>
                  <span className={styles.ledgerCellNote}>{row.readsNote}</span>
                </p>
                <p className={styles.ledgerCell}>
                  <span className={styles.ledgerCellLabel}>Writes</span>
                  <span className={styles.ledgerCellValue}>{row.writes}</span>
                  <span className={styles.ledgerCellNote}>
                    {row.writesNote}
                  </span>
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
