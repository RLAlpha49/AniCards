"use client";

import { useId, useRef } from "react";
import { AtSign, ExternalLink, Shield, Zap } from "@/lib/icons";
import styles from "../generator.module.css";

/** The three promises the generator makes, stated once. @source */
const FACTS = [
  { icon: Shield, text: "Public data only" },
  { icon: Zap, text: "No account" },
  { icon: ExternalLink, text: "Nothing stored about you" },
];

type UsernameStepProps = Readonly<{
  username: string;
  onUsernameChange: (username: string) => void;
}>;

/**
 * Step one: whose stats the cards describe.
 *
 * One field, focused on arrival, so a visitor who already knows their handle can
 * type it and move on. The cache note sits underneath as a footnote because it
 * describes an edge case, not a step.
 *
 * @source
 */
export function UsernameStep({
  username,
  onUsernameChange,
}: UsernameStepProps) {
  const inputId = useId();
  const hintId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const trimmed = username.trim();

  return (
    <div>
      <div className={styles.usernameGrid}>
        <div className={styles.field}>
          <label htmlFor={inputId} className={styles.fieldLabel}>
            <span>AniList username</span>
            <span className={styles.fieldHint}>
              {trimmed ? `Will read @${trimmed}` : "Required before generating"}
            </span>
          </label>

          <div className={styles.inputRow}>
            <span className={styles.inputIcon} aria-hidden="true">
              <AtSign />
            </span>
            <input
              ref={inputRef}
              id={inputId}
              type="text"
              value={username}
              onChange={(event) => onUsernameChange(event.target.value)}
              placeholder="Alpha49"
              aria-label="AniList username"
              aria-describedby={hintId}
              className={styles.input}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
            />
            {trimmed && (
              <button
                type="button"
                className={styles.inputAction}
                onClick={() => {
                  onUsernameChange("");
                  inputRef.current?.focus();
                }}
              >
                Clear
              </button>
            )}
          </div>

          <p id={hintId} className={styles.cacheNote}>
            <strong>First card?</strong> Give it a moment. AniCards reads your
            public list from AniList, generates your cards, and opens them on
            your profile page. Cards are cached for 24 hours, so a colour change
            made later can take a hard refresh (<kbd>Ctrl</kbd> + <kbd>F5</kbd>)
            to appear.
          </p>
        </div>
      </div>

      <ul className={styles.usernameFoot}>
        {FACTS.map((fact) => (
          <li key={fact.text} className={styles.usernameFact}>
            <fact.icon aria-hidden="true" />
            {fact.text}
          </li>
        ))}
      </ul>
    </div>
  );
}
