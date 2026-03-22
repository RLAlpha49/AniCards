"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Hash, Info, Loader2, Search, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { EASE_OUT_EXPO, scaleIn, VIEWPORT_ONCE } from "@/lib/animations";
import { cn } from "@/lib/utils";
import {
  safeTrack,
  trackFormSubmission,
  trackNavigation,
} from "@/lib/utils/google-analytics";

/** Supported lookup modes for the search form. @source */
type SearchMethod = "username" | "userid";

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

/**
 * Props for the SearchForm component.
 * @source
 */
interface SearchFormProps {
  /** Callback when loading state changes. */
  onLoadingChange?: (loading: boolean) => void;
}

/**
 * Search form component with username/userid toggle functionality.
 * @param props - Component props.
 * @returns The search form element.
 * @source
 */
export function SearchForm({ onLoadingChange }: Readonly<SearchFormProps>) {
  const router = useRouter();
  const [searchMethod, setSearchMethod] = useState<SearchMethod>("username");
  const [searchValue, setSearchValue] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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

      setError("");
      setLoading(true);
      onLoadingChange?.(true);

      safeTrack(() => trackFormSubmission("user_search", true));
      safeTrack(() => trackNavigation("user_page", "search_form"));

      const params = new URLSearchParams();
      if (searchMethod === "username") {
        params.set("username", trimmedValue);
      } else {
        params.set("userId", trimmedValue);
      }

      scheduleAfterPaint(() => {
        try {
          Promise.resolve(router.push(`/user?${params.toString()}`)).catch(
            () => {
              setLoading(false);
              onLoadingChange?.(false);
              setError("Something went wrong with navigation. Try again?");
            },
          );
        } catch {
          setLoading(false);
          onLoadingChange?.(false);
          setError("Something went wrong with navigation. Try again?");
        }
      });
    },
    [searchMethod, onLoadingChange, router],
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
                  <AlertDescription className="text-red-700 dark:text-red-300">
                    {error}
                  </AlertDescription>
                </Alert>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Method Toggle with sliding indicator */}
          <div className="space-y-3">
            <span className="
              block font-display text-[0.6rem] tracking-[0.3em] text-foreground/50 uppercase
            ">
              Look Up By
            </span>
            <div className="relative flex border border-gold/15 bg-gold/3">
              <motion.div
                className="absolute inset-y-0 left-0 w-1/2 border border-gold/25 bg-gold/10"
                initial={false}
                animate={{
                  x: searchMethod === "username" ? "0%" : "100%",
                }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
              <button
                type="button"
                onClick={() => {
                  setSearchMethod("username");
                  setError("");
                }}
                className={cn(
                  `
                    relative z-10 flex flex-1 items-center justify-center gap-2 py-3 text-sm
                    font-semibold transition-colors duration-200
                  `,
                  searchMethod === "username"
                    ? "text-gold"
                    : "text-foreground/40 hover:text-foreground/60",
                )}
              >
                <User className="size-4" />
                Username
              </button>
              <button
                type="button"
                onClick={() => {
                  setSearchMethod("userid");
                  setError("");
                }}
                className={cn(
                  `
                    relative z-10 flex flex-1 items-center justify-center gap-2 py-3 text-sm
                    font-semibold transition-colors duration-200
                  `,
                  searchMethod === "userid"
                    ? "text-gold"
                    : "text-foreground/40 hover:text-foreground/60",
                )}
              >
                <Hash className="size-4" />
                User ID
              </button>
            </div>
          </div>

          {/* Input field */}
          <div className="space-y-3">
            <label
              htmlFor="searchValue"
              className="
                block font-display text-[0.6rem] tracking-[0.3em] text-foreground/50 uppercase
              "
            >
              {searchMethod === "username"
                ? "AniList Username"
                : "AniList User ID"}
            </label>
            <div className="group relative">
              <div className="
                pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-foreground/30
                transition-colors duration-300
                group-focus-within:text-gold/70
              ">
                {searchMethod === "username" ? (
                  <Search className="size-5" />
                ) : (
                  <Hash className="size-5" />
                )}
              </div>
              <Input
                id="searchValue"
                value={searchValue}
                onChange={(e) => {
                  setSearchValue(e.target.value);
                  setError("");
                }}
                placeholder={
                  searchMethod === "username" ? "e.g., Alpha49" : "e.g., 542244"
                }
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
                  Pulling up their page...
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
          their numeric ID.
        </p>
      </motion.div>
    </div>
  );
}
