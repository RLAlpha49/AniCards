"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  AtSign,
  Hash,
  Search,
  User,
} from "@/lib/icons";
import { cn } from "@/lib/utils";
import {
  safeTrack,
  trackFormSubmission,
  trackNavigation,
  trackUserSearch,
} from "@/lib/utils/google-analytics";
import styles from "./search.module.css";

/** The two identifiers AniList accepts for a profile. @source */
type LookupMode = "username" | "userid";

/** A profile that already has cards, offered as a way in. @source */
const SAMPLE_PROFILE = {
  username: "Alpha49",
  userId: "542244",
} as const;

/** Matches a value that can only be a numeric AniList ID. @source */
const NUMERIC_ONLY = /^\d+$/;

type SearchLookupPanelProps = Readonly<{
  /** Called when the lookup starts and when it finishes. */
  onLoadingChange?: (loading: boolean) => void;
}>;

/**
 * The lookup panel on the search page.
 *
 * Replaces the old mode toggle plus field with one field that understands
 * either identifier. Typing digits into the username field offers the switch to
 * ID mode instead of failing the lookup, and the panel names the profile it is
 * about to read before the visitor commits.
 *
 * @param props.onLoadingChange - Reports the pending navigation so the page can
 *   show the lookup overlay.
 * @source
 */
export function SearchLookupPanel({ onLoadingChange }: SearchLookupPanelProps) {
  const router = useRouter();
  const inputId = useId();
  const errorId = useId();

  const [mode, setMode] = useState<LookupMode>("username");
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const trimmed = value.trim();
  const looksNumeric = mode === "username" && NUMERIC_ONLY.test(trimmed);
  const targetParam = mode === "username" ? "username" : "userId";

  /**
   * Runs the lookup: validates, reports it, and routes to the profile page.
   *
   * @param raw - The entered handle or ID.
   * @param target - Which identifier `raw` holds.
   * @source
   */
  const runLookup = (raw: string, target: LookupMode) => {
    const clean = raw.trim();

    if (!clean) {
      setError(
        `Please enter a ${target === "username" ? "username" : "user ID"}.`,
      );
      safeTrack(() => trackFormSubmission("user_search", false));
      return;
    }

    if (target === "userid" && !NUMERIC_ONLY.test(clean)) {
      setError("An AniList user ID is numbers only, such as 542244.");
      safeTrack(() => trackFormSubmission("user_search", false));
      return;
    }

    if (target === "username" && NUMERIC_ONLY.test(clean)) {
      setError(
        "That is a number, so it reads as a user ID. Switch to User ID, or type a handle.",
      );
      safeTrack(() => trackFormSubmission("user_search", false));
      return;
    }

    setError("");
    setLoading(true);
    onLoadingChange?.(true);
    safeTrack(() => trackFormSubmission("user_search", true));
    safeTrack(() => trackUserSearch());

    const params = new URLSearchParams();
    params.set(target === "username" ? "username" : "userId", clean);

    safeTrack(() => trackNavigation("user_page", "search_lookup"));
    router.push(`/user?${params.toString()}`);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    runLookup(value, mode);
  };

  const switchMode = (next: LookupMode) => {
    setMode(next);
    setError("");
  };

  /**
   * Moves a numeric value into ID mode and runs it, so a pasted ID never hits
   * the handle branch.
   * @source
   */
  const acceptAsId = () => {
    setMode("userid");
    runLookup(trimmed, "userid");
  };

  const openSample = () => {
    safeTrack(() => trackNavigation("user_page", "search_sample"));
    router.push(`/user?userId=${SAMPLE_PROFILE.userId}`);
  };

  return (
    <div className={styles.panel}>
      <div className={styles.panelHead}>
        <span className={styles.panelSeal} aria-hidden="true">
          検
        </span>
        <p className={styles.panelTitle}>Find your cards</p>
        <span className={styles.panelHeadRule} aria-hidden="true" />
        <span className={styles.panelMode}>
          {mode === "username" ? "By handle" : "By ID"}
        </span>
      </div>

      <form onSubmit={handleSubmit}>
        <div className={styles.modes} role="group" aria-label="Search by">
          <button
            type="button"
            onClick={() => switchMode("username")}
            aria-pressed={mode === "username"}
            className={cn(
              styles.mode,
              mode === "username" && styles.modeActive,
            )}
          >
            <User aria-hidden="true" />
            Username
          </button>
          <button
            type="button"
            onClick={() => switchMode("userid")}
            aria-pressed={mode === "userid"}
            className={cn(styles.mode, mode === "userid" && styles.modeActive)}
          >
            <Hash aria-hidden="true" />
            User ID
          </button>
        </div>

        <div className={styles.field}>
          <div className={styles.fieldLabel}>
            <label htmlFor={inputId}>
              {mode === "username" ? "AniList Username" : "AniList User ID"}
            </label>
            <span className={styles.fieldHint}>
              {trimmed
                ? mode === "username"
                  ? looksNumeric
                    ? "Looks like an ID"
                    : `Reading @${trimmed}`
                  : `Reading #${trimmed}`
                : "Required"}
            </span>
          </div>

          <div className={styles.input}>
            {mode === "username" ? (
              <AtSign className={styles.inputIcon} aria-hidden="true" />
            ) : (
              <Hash className={styles.inputIcon} aria-hidden="true" />
            )}
            <input
              id={inputId}
              type="text"
              value={value}
              onChange={(event) => {
                setValue(event.target.value);
                setError("");
              }}
              placeholder={
                mode === "username"
                  ? "Enter username (e.g., Alpha49)"
                  : "Enter user ID (e.g., 542244)"
              }
              aria-describedby={error ? errorId : undefined}
              aria-invalid={error ? true : undefined}
              className={styles.inputField}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              disabled={loading}
            />
            {trimmed && (
              <button
                type="button"
                onClick={() => {
                  setValue("");
                  setError("");
                }}
                className={styles.inputClear}
              >
                Clear
              </button>
            )}
          </div>

          {/* A pasted number is an ID. Offer the switch before it fails. */}
          {looksNumeric && (
            <p className={styles.detect}>
              That looks like a numeric ID.
              <button
                type="button"
                onClick={acceptAsId}
                className={styles.detectButton}
              >
                Look it up as a user ID
              </button>
            </p>
          )}

          {/* The address the form will open, so the destination is never a
              surprise when the profile page loads. Hidden while the value
              reads as an ID in handle mode, because the form refuses that
              until the mode is switched. */}
          {!looksNumeric && (
            <p className={styles.target}>
              <span className={styles.targetLabel}>Opens</span>
              <code className={styles.targetUrl}>
                /user?{targetParam}=
                {trimmed ? (
                  <mark>{trimmed}</mark>
                ) : (
                  <span className={styles.targetEmpty}>…</span>
                )}
              </code>
            </p>
          )}
        </div>

        {error && (
          <p id={errorId} role="alert" className={styles.error}>
            <AlertCircle className={styles.errorIcon} aria-hidden="true" />
            {error}
          </p>
        )}

        <button type="submit" className={styles.submit} disabled={loading}>
          {loading ? (
            <>
              <Search className={styles.submitIcon} aria-hidden="true" />
              Searching...
            </>
          ) : (
            <>
              <Search className={styles.submitIcon} aria-hidden="true" />
              Open the cards
              <ArrowRight className={styles.submitIcon} aria-hidden="true" />
            </>
          )}
        </button>
      </form>

      <p className={styles.panelNote}>
        This opens cards you already made, without going through the generator
        again. If you have never made any,{" "}
        <Link href="/generator" className={styles.inlineLink}>
          start with the generator
        </Link>
        .
      </p>

      <p className={styles.sample}>
        Nothing saved yet?
        <button
          type="button"
          onClick={openSample}
          className={styles.sampleButton}
        >
          See a sample profile
          <ArrowRight className={styles.sampleIcon} aria-hidden="true" />
        </button>
      </p>
    </div>
  );
}
