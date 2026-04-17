"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Hash, Info, Loader2, Search, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  EASE_OUT_EXPO,
  NO_MOTION_TRANSITION,
  scaleIn,
  VIEWPORT_ONCE,
} from "@/lib/animations";
import type { SearchLookupMode } from "@/lib/seo";
import {
  getBlankSearchLookupError,
  getSearchLookupValidationError,
  getSearchPagePath,
  normalizeSearchLookupInput,
} from "@/lib/seo";
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

function replaceCurrentSearchPageUrl(nextPath: string) {
  if (globalThis.window === undefined) {
    return;
  }

  const nextUrl = `${nextPath}${globalThis.window.location.hash}`;
  const currentUrl = `${globalThis.window.location.pathname}${globalThis.window.location.search}${globalThis.window.location.hash}`;

  if (nextUrl === currentUrl) {
    return;
  }

  globalThis.window.history.replaceState(null, "", nextUrl);
}

function getSearchModeAnnouncement(nextMethod: SearchLookupMode): string {
  if (nextMethod === "username") {
    return "Search mode changed to AniList username.";
  }

  return "Search mode changed to AniList user ID.";
}

function getSearchInputMeta(searchMethod: SearchLookupMode): {
  inputLabel: string;
  inputPlaceholder: string;
  inputHint: string;
  inputType: "text" | "search";
  inputMode: "numeric" | "search";
  Icon: typeof Search;
} {
  if (searchMethod === "userId") {
    return {
      inputLabel: "AniList User ID",
      inputPlaceholder: "e.g., 542244 or /user/542244",
      inputHint:
        "Paste a numeric AniList ID. AniList /user/... links also work when they resolve to an ID.",
      inputType: "text",
      inputMode: "numeric",
      Icon: Hash,
    };
  }

  return {
    inputLabel: "AniList Username",
    inputPlaceholder: "e.g., Alpha49, @Alpha49, or /user/Alpha49",
    inputHint:
      "Paste a username, @handle, AniList profile URL, copied /user/... slug, or a bare numeric ID.",
    inputType: "search",
    inputMode: "search",
    Icon: Search,
  };
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
  /** Initial field error derived from the current search page URL. */
  initialFieldError?: string;
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
  initialFieldError = "",
  onLoadingChange,
}: Readonly<SearchFormProps>) {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion() ?? false;
  const baseId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const previousRouteStateRef = useRef({
    initialFieldError,
    initialSearchMode,
    initialSearchValue,
  });
  const [searchMethod, setSearchMethod] =
    useState<SearchLookupMode>(initialSearchMode);
  const [searchValue, setSearchValue] = useState(initialSearchValue);
  const [fieldError, setFieldError] = useState(initialFieldError);
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);
  const [modeAnnouncement, setModeAnnouncement] = useState("");
  const [hasMounted, setHasMounted] = useState(false);

  const alertMessage = fieldError || formError;
  const hasFieldError = fieldError.length > 0;
  const inputId = `${baseId}-search-value`;
  const inputHintId = `${baseId}-search-hint`;
  const errorId = `${baseId}-search-error`;
  const searchMethodName = `${baseId}-search-method`;
  const usernameRadioId = `${baseId}-search-method-username`;
  const userIdRadioId = `${baseId}-search-method-userid`;
  const searchMethodHintId = `${baseId}-search-method-hint`;
  const {
    inputLabel,
    inputPlaceholder,
    inputHint,
    inputType,
    inputMode,
    Icon: SearchInputIcon,
  } = getSearchInputMeta(searchMethod);
  const inputDescribedBy = hasFieldError
    ? `${inputHintId} ${errorId}`
    : inputHintId;

  useEffect(() => {
    setSearchMethod(initialSearchMode);
  }, [initialSearchMode]);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    setSearchValue(initialSearchValue);
  }, [initialSearchValue]);

  useEffect(() => {
    setFieldError(initialFieldError);
    setFormError("");
  }, [initialFieldError, onLoadingChange]);

  useEffect(() => {
    const previousRouteState = previousRouteStateRef.current;
    const routeStateChanged =
      previousRouteState.initialFieldError !== initialFieldError ||
      previousRouteState.initialSearchMode !== initialSearchMode ||
      previousRouteState.initialSearchValue !== initialSearchValue;

    previousRouteStateRef.current = {
      initialFieldError,
      initialSearchMode,
      initialSearchValue,
    };

    if (!routeStateChanged || !loading) {
      return;
    }

    setLoading(false);
    onLoadingChange?.(false);
  }, [
    initialFieldError,
    initialSearchMode,
    initialSearchValue,
    loading,
    onLoadingChange,
  ]);

  const focusSearchField = useCallback((selectContents = false) => {
    scheduleAfterPaint(() => {
      const input = inputRef.current;
      if (!input) {
        return;
      }

      input.focus();

      if (selectContents && input.value.length > 0) {
        input.select();
      }
    });
  }, []);

  const clearErrors = useCallback(() => {
    setFieldError("");
    setFormError("");
  }, []);

  const showValidationError = useCallback(
    (message: string, options?: { selectContents?: boolean }) => {
      setFieldError(message);
      setFormError("");
      focusSearchField(options?.selectContents ?? false);
      safeTrack(() => trackFormSubmission("user_search", false));
    },
    [focusSearchField],
  );

  const updateSearchMethod = useCallback(
    (nextMethod: SearchLookupMode) => {
      if (nextMethod !== searchMethod) {
        setModeAnnouncement(getSearchModeAnnouncement(nextMethod));

        const nextSearchPagePath = getSearchPagePath({
          mode: nextMethod,
          query: searchValue,
          includeDefaultMode:
            nextMethod !== "username" || Boolean(searchValue.trim()),
        });

        replaceCurrentSearchPageUrl(nextSearchPagePath);
      }

      setSearchMethod(nextMethod);
      clearErrors();
    },
    [clearErrors, searchMethod, searchValue],
  );

  /**
   * Validates input, tracks analytics, and routes to the user page.
   * The user page is responsible for handling "not found" and setup flows.
   * @param value - The entered username or AniList user ID.
   * @source
   */
  const performSearch = useCallback(
    (value: string) => {
      const normalizedLookup = normalizeSearchLookupInput(value, searchMethod);

      if (!normalizedLookup) {
        showValidationError(getBlankSearchLookupError(searchMethod));
        return;
      }

      if (!normalizedLookup.ok) {
        showValidationError(
          getSearchLookupValidationError(searchMethod, normalizedLookup.reason),
          {
            selectContents: true,
          },
        );
        return;
      }

      const nextSearchMode = normalizedLookup.mode;
      const nextSearchValue = normalizedLookup.query;

      clearErrors();
      setSearchValue(nextSearchValue);
      setLoading(true);
      onLoadingChange?.(true);

      safeTrack(() => trackFormSubmission("user_search", true));
      safeTrack(() => trackNavigation("search", "search_form"));

      const nextUrl = getSearchPagePath({
        mode: nextSearchMode,
        query: nextSearchValue,
      });

      scheduleAfterPaint(() => {
        try {
          Promise.resolve(router.push(nextUrl)).catch(() => {
            setLoading(false);
            onLoadingChange?.(false);
            setFieldError("");
            setFormError("Something went wrong with navigation. Try again?");
          });
        } catch {
          setLoading(false);
          onLoadingChange?.(false);
          setFieldError("");
          setFormError("Something went wrong with navigation. Try again?");
        }
      });
    },
    [clearErrors, onLoadingChange, router, searchMethod, showValidationError],
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
        initial={false}
        whileInView={prefersReducedMotion ? undefined : "visible"}
        viewport={VIEWPORT_ONCE}
        className="relative border-2 border-gold/20 bg-background/80 p-8 backdrop-blur-sm sm:p-10"
      >
        {/* Enlarged corner brackets */}
        <div className="absolute -top-px -left-px size-5 border-t-2 border-l-2 border-gold" />
        <div className="absolute -top-px -right-px size-5 border-t-2 border-r-2 border-gold" />
        <div className="absolute -bottom-px -left-px size-5 border-b-2 border-l-2 border-gold" />
        <div className="absolute -right-px -bottom-px size-5 border-r-2 border-b-2 border-gold" />

        <form
          data-testid="search-form"
          data-ui-ready={hasMounted ? "true" : "false"}
          method="get"
          action="/search"
          onSubmit={handleSubmit}
          className="space-y-6"
        >
          {searchMethod === "userId" ? (
            <input type="hidden" name="mode" value="userId" />
          ) : null}

          <p
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="sr-only"
          >
            {modeAnnouncement}
          </p>

          {alertMessage ? (
            <motion.div
              initial={
                prefersReducedMotion
                  ? false
                  : { opacity: 0, scale: 0.95, height: 0 }
              }
              animate={{ opacity: 1, scale: 1, height: "auto" }}
              transition={
                prefersReducedMotion ? NO_MOTION_TRANSITION : { duration: 0.3 }
              }
            >
              <Alert
                variant="destructive"
                className="border-red-200/50 bg-red-50/80 dark:border-red-800/50 dark:bg-red-950/30"
              >
                <Info className="size-4" />
                <AlertTitle className="text-red-800 dark:text-red-200">
                  {hasFieldError
                    ? "Check the search field"
                    : "Navigation hiccup"}
                </AlertTitle>
                <AlertDescription className="text-red-700 dark:text-red-300">
                  {alertMessage}
                </AlertDescription>
              </Alert>
            </motion.div>
          ) : null}

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
                transition={
                  prefersReducedMotion
                    ? NO_MOTION_TRANSITION
                    : { type: "spring", stiffness: 400, damping: 30 }
                }
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
            <div className="group relative">
              <div
                aria-hidden="true"
                className="
                  pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-foreground/30
                  transition-colors duration-300
                  group-focus-within:text-gold/70
                "
              >
                <SearchInputIcon className="size-5" />
              </div>
              <Input
                ref={inputRef}
                id={inputId}
                name="query"
                type={inputType}
                value={searchValue}
                onChange={(e) => {
                  setSearchValue(e.target.value);
                  clearErrors();
                }}
                placeholder={inputPlaceholder}
                inputMode={inputMode}
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                enterKeyHint="search"
                spellCheck={false}
                aria-invalid={hasFieldError ? true : undefined}
                aria-describedby={inputDescribedBy}
                aria-errormessage={hasFieldError ? errorId : undefined}
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
            <div className="space-y-1.5">
              <p
                id={inputHintId}
                className="text-sm/relaxed text-foreground/45"
              >
                {inputHint}
              </p>
              {hasFieldError ? (
                <p
                  id={errorId}
                  className="text-sm font-medium text-red-700 dark:text-red-300"
                >
                  {fieldError}
                </p>
              ) : null}
            </div>
          </div>

          {/* Submit button */}
          <motion.div
            whileHover={
              prefersReducedMotion || loading
                ? undefined
                : {
                    scale: 1.03,
                    transition: { duration: 0.25, ease: EASE_OUT_EXPO },
                  }
            }
            whileTap={
              prefersReducedMotion || loading ? undefined : { scale: 0.97 }
            }
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
                  Checking profile...
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
          Works with any public AniList profile — usernames, @handles, copied
          AniList profile links, /user/... slugs, and bare numeric IDs all pass
          through the same lookup flow before the editor opens.
        </p>
      </motion.div>
    </div>
  );
}
