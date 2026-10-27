"use client";

import Link from "next/link";
import { ArrowRight, RefreshCw, Search } from "@/lib/icons";
import { cn } from "@/lib/utils";
import styles from "./user.module.css";

type UserPageStateProps = Readonly<{
  /** Which state to render. */
  state: "loading" | "error" | "missing" | "empty";
  /** Message for the error state. */
  message?: string;
}>;

/**
 * Loading, error, missing-profile, and empty-set states for the user page.
 *
 * All four use the same paper panel, so a failure looks like part of the page
 * rather than a stray dialog. Each one offers the action that actually helps:
 * the error state retries, the empty set goes to the generator, and a missing
 * profile goes to the lookup that finds a real one.
 *
 * @param props.state - Which state to render.
 * @param props.message - Error text, shown only by the error state.
 * @source
 */
export function UserPageState({ state, message }: UserPageStateProps) {
  if (state === "loading") {
    return (
      <div className={styles.stateWrap}>
        <div className={styles.loader} role="status" aria-live="polite">
          <span className={styles.loaderSeal} aria-hidden="true">
            読
          </span>
          <div className={styles.loaderBars} aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <p className={styles.loaderText}>
            Reading the cards saved for this profile
          </p>
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className={styles.stateWrap}>
        <div className={styles.panel}>
          <span className={styles.panelSeal} aria-hidden="true">
            誤
          </span>
          <h1>Something went wrong</h1>
          <p>{message ?? "The cards could not be read. Try again."}</p>
          <div className={styles.panelActions}>
            <button
              type="button"
              onClick={() => globalThis.location.reload()}
              className={styles.primaryAction}
            >
              <RefreshCw aria-hidden="true" />
              Try again
            </button>
            <Link href="/" className={styles.secondaryAction}>
              Return home
              <ArrowRight aria-hidden="true" />
            </Link>
          </div>
          <p className={styles.panelNote}>
            If the profile exists, it may not have any cards saved yet.
          </p>
        </div>
      </div>
    );
  }

  if (state === "missing") {
    return (
      <div className={styles.stateWrap}>
        <div className={styles.panel}>
          <span className={styles.panelSeal} aria-hidden="true">
            無
          </span>
          <h1>User not found</h1>
          <p>
            No AniList profile matches this address. The handle may have
            changed, or the link may be incomplete.
          </p>
          <div className={styles.panelActions}>
            <Link href="/search" className={styles.primaryAction}>
              <Search aria-hidden="true" />
              Find a profile
            </Link>
            <Link href="/" className={styles.secondaryAction}>
              Return home
              <ArrowRight aria-hidden="true" />
            </Link>
          </div>
          <p className={styles.panelNote}>
            A handle and an AniList user ID both work on the search page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(styles.empty, styles.emptyPanel)}>
      <span className={styles.emptySeal} aria-hidden="true">
        空
      </span>
      <h2>No cards saved yet</h2>
      <p>
        This profile has no cards saved against it. The generator makes a set in
        four steps, and the cards are kept against the AniList profile they came
        from.
      </p>
      <div className={styles.emptyActions}>
        <Link href="/generator" className={styles.primaryAction}>
          Generate a set
          <ArrowRight aria-hidden="true" />
        </Link>
        <Link href="/examples" className={styles.secondaryAction}>
          See every card type
          <ArrowRight aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
