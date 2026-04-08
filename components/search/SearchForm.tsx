"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Hash, Info, Loader2, Search, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { EASE_OUT_EXPO, scaleIn, VIEWPORT_ONCE } from "@/lib/animations";
import { normalizePositiveIntegerString } from "@/lib/api/primitives";
import type { SearchLookupMode } from "@/lib/seo";
import { getSearchPagePath, getUserProfilePath } from "@/lib/seo";
import { cn } from "@/lib/utils";
import {
  safeTrack,
  trackFormSubmission,
  trackNavigation,
} from "@/lib/utils/google-analytics";

function scheduleAfterPaint(callback: () => void) {
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(() => {
      requestAnimationFrame(callback);
    });
    return;
  }

  // Fallback for environments without requestAnimationFrame (e.g., some tests).
  setTimeout(callback, 0);
}

function normalizeAniListUserId(value: string): string | null {
  return normalizePositiveIntegerString(value);
}

/**
 * Props for the SearchForm component.
 * @source
 */
interface SearchFormProps {
  /** Initial lookup mode derived from the current search page URL. */
  initialSearchMode?: SearchLookupMode;
  /** Initial search value derived from the current search page URL. */
  initialSearchValue?: string;
  /** Callback when loading state changes. */
  onLoadingChange?: (loading: boolean) => void;
}

/**
 * Search form component with username/userid toggle functionality.
 * @param props - Component props.
 * @returns The search form element.
 * @source
 */
export function SearchForm({
  initialSearchMode = "username",
  initialSearchValue = "",
  onLoadingChange,
}: Readonly<SearchFormProps>) {
  const router = useRouter();
  const baseId = useId();
  const [searchMethod, setSearchMethod] =
    useState<SearchLookupMode>(initialSearchMode);
  const [searchValue, setSearchValue] = useState(initialSearchValue);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [modeAnnouncement, setModeAnnouncement] = useState("");

  const isUserIdMode = searchMethod === "userId";
  const inputId = `${baseId}-search-value`;
  const inputHintId = `${baseId}-search-hint`;
  const errorId = `${baseId}-search-error`;
  const searchMethodName = `${baseId}-search-method`;
  const usernameRadioId = `${baseId}-search-method-username`;
  const userIdRadioId = `${baseId}-search-method-userid`;
  const searchMethodHintId = `${baseId}-search-method-hint`;
  const inputLabel = isUserIdMode ? "AniList User ID" : "AniList Username";
  const inputPlaceholder = isUserIdMode ? "e.g., 542244" : "e.g., Alpha49";
  const inputDescribedBy = error ? `${inputHintId} ${errorId}` : inputHintId;

  useEffect(() => {
    setSearchMethod(initialSearchMode);
  }, [initialSearchMode]);

  useEffect(() => {
    setSearchValue(initialSearchValue);
  }, [initialSearchValue]);

  const updateSearchMethod = useCallback(
    (nextMethod: SearchLookupMode) => {
      if (nextMethod !== searchMethod) {
        setModeAnnouncement(
          nextMethod === "username"
            ? "Search mode changed to AniList username."
            : "Search mode changed to AniList user ID.",
        );

        const nextSearchPagePath = getSearchPagePath({
          mode: nextMethod,
          query: searchValue,
          includeDefaultMode:
            nextMethod !== "username" || Boolean(searchValue.trim()),
        });

        void Promise.resolve(router.replace(nextSearchPagePath)).catch(() => {
          return undefined;
        });
      }

      setSearchMethod(nextMethod);
      setError("");
    },
    [router, searchMethod, searchValue],
  );

  /**
   * Validates input, tracks analytics, and routes to the user page.
   * The user page is responsible for handling "not found" and setup flows.
   * @param value - The entered username or AniList user ID.
   * @source
   */
  const performSearch = useCallback(
    (value: string) => {
      const trimmedValue = value.trim();

      if (!trimmedValue) {
        setError(
          `You'll need to enter a ${searchMethod === "username" ? "username" : "user ID"} first`,
        );
        safeTrack(() => trackFormSubmission("user_search", false));
        return;
      }

      const normalizedUserId = isUserIdMode
        ? normalizeAniListUserId(trimmedValue)
        : null;

      if (isUserIdMode && !normalizedUserId) {
        setError("AniList user IDs must be a whole number greater than 0.");
        safeTrack(() => trackFormSubmission("user_search", false));
        return;
      }

      const nextSearchValue = normalizedUserId ?? trimmedValue;

      setError("");
      setSearchValue(nextSearchValue);
      setLoading(true);
      onLoadingChange?.(true);

      safeTrack(() => trackFormSubmission("user_search", true));
      safeTrack(() => trackNavigation("user_page", "search_form"));

      const nextUrl =
        searchMethod === "username"
          ? getUserProfilePath(nextSearchValue)
          : `/user?${new URLSearchParams({ userId: nextSearchValue }).toString()}`;

      scheduleAfterPaint(() => {
        try {
          Promise.resolve(router.push(nextUrl)).catch(() => {
            setLoading(false);
            onLoadingChange?.(false);
            setError("Something went wrong with navigation. Try again?");
          });
        } catch {
          setLoading(false);
          onLoadingChange?.(false);
          setError("Something went wrong with navigation. Try again?");
        }
      });
    },
    [isUserIdMode, onLoadingChange, router, searchMethod],
  );

  /**
   * Handles form submission.
   * @param e - The form submission event.
   * @source
   */
  const handleSubmit = (e: { preventDefault(): void }) => {
    e.preventDefault();
    performSearch(searchValue);
  };

  return (
    <div className="relative mx-auto w-full max-w-xl">
      {/* Ambient glow behind form */}
      <div className="
        pointer-events-none absolute -inset-8
        bg-[radial-gradient(ellipse_at_center,hsl(var(--gold)/0.10),transparent_70%)] blur-2xl
      " />

      <motion.div
        variants={scaleIn}
        initial="hidden"
        whileInView="visible"
        viewport={VIEWPORT_ONCE}
        className="relative border-2 border-gold/20 bg-background/80 p-8 backdrop-blur-sm sm:p-10"
      >
        {/* Enlarged corner brackets */}
        <div className="absolute -top-px -left-px size-5 border-t-2 border-l-2 border-gold" />
        <div className="absolute -top-px -right-px size-5 border-t-2 border-r-2 border-gold" />
        <div className="absolute -bottom-px -left-px size-5 border-b-2 border-l-2 border-gold" />
        <div className="absolute -right-px -bottom-px size-5 border-r-2 border-b-2 border-gold" />

        <form onSubmit={handleSubmit} className="space-y-6">
          <p
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="sr-only"
          >
            {modeAnnouncement}
          </p>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, height: 0 }}
                animate={{ opacity: 1, scale: 1, height: "auto" }}
                exit={{ opacity: 0, scale: 0.95, height: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Alert
                  variant="destructive"
                  className="
                    border-red-200/50 bg-red-50/80
                    dark:border-red-800/50 dark:bg-red-950/30
                  "
                >
                  <Info className="size-4" />
                  <AlertTitle className="text-red-800 dark:text-red-200">
                    Heads Up
                  </AlertTitle>
                  <AlertDescription
                    id={errorId}
                    className="text-red-700 dark:text-red-300"
                  >
                    {error}
                  </AlertDescription>
                </Alert>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Method Toggle with sliding indicator */}
          <fieldset className="space-y-3" aria-describedby={searchMethodHintId}>
            <legend className="
              block font-display text-[0.6rem] tracking-[0.3em] text-foreground/50 uppercase
            ">
              Look Up By
            </legend>
            <p id={searchMethodHintId} className="sr-only">
              Choose whether to search by AniList username or numeric AniList
              user ID.
            </p>
            <div className="relative flex border border-gold/15 bg-gold/3">
              <motion.div
                className="absolute inset-y-0 left-0 w-1/2 border border-gold/25 bg-gold/10"
                initial={false}
                animate={{
                  x: searchMethod === "username" ? "0%" : "100%",
                }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
              <label className="flex flex-1">
                <input
                  id={usernameRadioId}
                  type="radio"
                  name={searchMethodName}
                  value="username"
                  checked={searchMethod === "username"}
                  onChange={() => updateSearchMethod("username")}
                  className="peer sr-only"
                />
                <span
                  className={cn(
                    `
                      relative z-10 flex w-full items-center justify-center gap-2 py-3 text-sm
                      font-semibold transition-colors duration-200
                      peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2
                      peer-focus-visible:outline-gold
                    `,
                    searchMethod === "username"
                      ? "text-gold"
                      : "text-foreground/40 hover:text-foreground/60",
                  )}
                >
                  <User aria-hidden="true" className="size-4" />
                  Username
                </span>
              </label>
              <label className="flex flex-1">
                <input
                  id={userIdRadioId}
                  type="radio"
                  name={searchMethodName}
                  value="userId"
                  checked={searchMethod === "userId"}
                  onChange={() => updateSearchMethod("userId")}
                  className="peer sr-only"
                />
                <span
                  className={cn(
                    `
                      relative z-10 flex w-full items-center justify-center gap-2 py-3 text-sm
                      font-semibold transition-colors duration-200
                      peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2
                      peer-focus-visible:outline-gold
                    `,
                    searchMethod === "userId"
                      ? "text-gold"
                      : "text-foreground/40 hover:text-foreground/60",
                  )}
                >
                  <Hash aria-hidden="true" className="size-4" />
                  User ID
                </span>
              </label>
            </div>
          </fieldset>

          {/* Input field */}
          <div className="space-y-3">
            <label
              htmlFor={inputId}
              className="
                block font-display text-[0.6rem] tracking-[0.3em] text-foreground/50 uppercase
              "
            >
              {inputLabel}
            </label>
            <p id={inputHintId} className="sr-only">
              {isUserIdMode
                ? "Enter a numeric AniList user ID."
                : "Enter an AniList username without the at symbol."}
            </p>
            <div className="group relative">
              <div
                aria-hidden="true"
                className="
                  pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-foreground/30
                  transition-colors duration-300
                  group-focus-within:text-gold/70
                "
              >
                {isUserIdMode ? (
                  <Hash className="size-5" />
                ) : (
                  <Search className="size-5" />
                )}
              </div>
              <Input
                id={inputId}
                type={isUserIdMode ? "text" : "search"}
                value={searchValue}
                onChange={(e) => {
                  setSearchValue(e.target.value);
                  setError("");
                }}
                placeholder={inputPlaceholder}
                inputMode={isUserIdMode ? "numeric" : "search"}
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                enterKeyHint="search"
                spellCheck={false}
                aria-invalid={error ? true : undefined}
                aria-describedby={inputDescribedBy}
                aria-errormessage={error ? errorId : undefined}
                className="
                  h-14 border-gold/15 bg-transparent pl-12 text-base transition-all
                  placeholder:text-foreground/25
                  hover:border-gold/30
                  focus:border-gold focus:ring-2 focus:ring-gold/20
                  dark:border-gold/15 dark:bg-background/50
                  dark:placeholder:text-foreground/25
                  dark:hover:border-gold/30
                  dark:focus:border-gold
                "
                disabled={loading}
              />
            </div>
          </div>

          {/* Submit button */}
          <motion.div
            whileHover={
              loading
                ? undefined
                : {
                    scale: 1.03,
                    transition: { duration: 0.25, ease: EASE_OUT_EXPO },
                  }
            }
            whileTap={loading ? undefined : { scale: 0.97 }}
          >
            <Button
              type="submit"
              size="lg"
              className="
                group imperial-btn h-14 w-full imperial-btn-fill text-base
                disabled:opacity-70
                disabled:hover:scale-100
              "
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 size-5 animate-spin" />
                  Pulling up the page...
                </>
              ) : (
                <>
                  <Search className="mr-2 size-5" />
                  Find Profile
                  <ArrowRight className="ml-2 size-5 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </Button>
          </motion.div>
        </form>

        <p className="mt-6 text-center font-body-serif text-xs/relaxed text-foreground/30">
          Works with any public AniList profile — just type a username or paste
          the numeric ID.
        </p>
      </motion.div>
    </div>
  );
}
