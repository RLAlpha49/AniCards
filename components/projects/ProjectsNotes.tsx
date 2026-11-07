"use client";

import { ShieldCheck } from "@/lib/icons";
import { useRevealInView } from "@/hooks/useRevealInView";
import { cn } from "@/lib/utils";
import homeStyles from "@/components/home/home.module.css";
import { SHARED_NOTES } from "./catalogue";
import styles from "./projects.module.css";

/**
 * The safety notes both tools share.
 *
 * Sits between the last entry and the closing action. A visitor who has just
 * read what each tool writes gets the three things to know before a bulk run,
 * in one place rather than repeated on each entry.
 * @source
 */
export function ProjectsNotes() {
  const { ref, phase } = useRevealInView<HTMLDivElement>();

  return (
    <section className={styles.notes}>
      <div
        ref={ref}
        data-reveal={phase}
        className={cn(styles.notesInner, homeStyles.reveal)}
      >
        <header className={styles.notesHead}>
          <span className={styles.notesSeal} aria-hidden="true">
            <ShieldCheck width={18} height={18} />
          </span>
          <div>
            <h2 className={styles.notesTitle}>Before a bulk run</h2>
            <p className={styles.notesNote}>
              Both tools write to AniList for you. These are the three things
              worth doing first.
            </p>
          </div>
        </header>

        <ol className={styles.notesList}>
          {SHARED_NOTES.map((note, index) => (
            <li key={note.title} className={styles.note}>
              <span className={styles.noteNum} aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <h3 className={styles.noteTitle}>{note.title}</h3>
                <p className={styles.noteBody}>{note.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
