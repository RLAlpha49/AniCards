"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, Hash, Search, User } from "@/lib/icons";
import { cn } from "@/lib/utils";
import {
  safeTrack,
  trackFormSubmission,
  trackNavigation,
  trackUserSearch,
} from "@/lib/utils/google-analytics";
import { LookupField } from "./LookupField";
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
 * Names the problem with an entered handle or ID.
 *
 * @param raw - The entered value, untrimmed.
 * @param target - Which identifier the field currently holds.
 * @returns The message to show, or an empty string when the value is usable.
 * @source
 */
function describeLookupProblem(raw: string, target: LookupMode): string {
  const clean = raw.trim();
  if (!clean) {
    return `Please enter a ${target === "username" ? "username" : "user ID"}.`;
  }
  if (target === "userid" && !NUMERIC_ONLY.test(clean)) {
    return "An AniList user ID is numbers only, such as 542244.";
  }
  if (target === "username" && NUMERIC_ONLY.test(clean)) {
    return "That is a number, so it reads as a user ID. Switch to User ID, or type a handle.";
  }
  return "";
}

/**
 * Describes what the field currently holds.
 *
 * @param mode - Which identifier the field is in.
 * @param trimmed - The entered value, trimmed.
 * @param looksNumeric - Whether the value is all digits in handle mode.
 * @returns The short hint shown beside the label.
 * @source
 */
function describeFieldHint(
  mode: LookupMode,
  trimmed: string,
  looksNumeric: boolean,
): string {
  if (!trimmed) return "Required";
  if (looksNumeric) return "Looks like an ID";
  return mode === "userid" ? `Reading #${trimmed}` : `Reading @${trimmed}`;
}

/**
 * The lookup panel on the search page.
 *
 * Replaces the old mode toggle plus field with one field that understands
 * either identifier. Typing digits into the username field offers the switch
 * to ID mode instead of failing the lookup, and the panel names the profile it
 * is about to read before the visitor commits.
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
  const fieldHint = describeFieldHint(mode, trimmed, looksNumeric);

  // Values the markup reads, computed here so the JSX stays free of branches.
  const isUsernameMode = mode === "username";
  const modeLabel = isUsernameMode ? "By handle" : "By ID";
  const fieldLabel = isUsernameMode ? "AniList Username" : "AniList User ID";
  const placeholder = isUsernameMode
    ? "Enter username (e.g., Alpha49)"
    : "Enter user ID (e.g., 542244)";

  /**
   * Runs the lookup: validates, reports it, and routes to the profile page.
   *
   * @param raw - The entered handle or ID.
   * @param target - Which identifier `raw` holds.
   * @source
   */
  const runLookup = (raw: string, target: LookupMode) => {
    const problem = describeLookupProblem(raw, target);
    if (problem) {
      setError(problem);
      safeTrack(() => trackFormSubmission("user_search", false));
      return;
    }

    setError("");
    setLoading(true);
    onLoadingChange?.(true);
    safeTrack(() => trackFormSubmission("user_search", true));
    safeTrack(() => trackUserSearch());

    const params = new URLSearchParams();
    params.set(target === "username" ? "username" : "userId", raw.trim());

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
        <span className={styles.panelMode}>{modeLabel}</span>
      </div>

      <form onSubmit={handleSubmit}>
        <fieldset className="min-w-0" aria-label="Search by">
          <div className={styles.modes}>
            <button
              type="button"
              onClick={() => switchMode("username")}
              aria-pressed={isUsernameMode}
              className={cn(styles.mode, isUsernameMode && styles.modeActive)}
            >
              <User aria-hidden="true" />
              Username
            </button>
            <button
              type="button"
              onClick={() => switchMode("userid")}
              aria-pressed={!isUsernameMode}
              className={cn(styles.mode, !isUsernameMode && styles.modeActive)}
            >
              <Hash aria-hidden="true" />
              User ID
            </button>
          </div>
        </fieldset>

        <LookupField
          inputId={inputId}
          label={fieldLabel}
          hint={fieldHint}
          placeholder={placeholder}
          value={value}
          trimmed={trimmed}
          isIdMode={!isUsernameMode}
          looksNumeric={looksNumeric}
          targetParam={targetParam}
          errorId={errorId}
          hasError={!!error}
          disabled={loading}
          onChange={(next) => {
            setValue(next);
            setError("");
          }}
          onClear={() => {
            setValue("");
            setError("");
          }}
          onAcceptAsId={acceptAsId}
        />

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
        Nothing saved yet?{" "}
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
