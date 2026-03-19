"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Hash, Info, Loader2, Search, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import {
  safeTrack,
  trackFormSubmission,
  trackNavigation,
} from "@/lib/utils/google-analytics";

/** Supported lookup modes for the search form. @source */
type SearchMethod = "username" | "userid";

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

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
          `Please enter a ${searchMethod === "username" ? "username" : "user ID"}`,
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
              setError("Navigation failed. Please try again.");
            },
          );
        } catch {
          setLoading(false);
          onLoadingChange?.(false);
          setError("Navigation failed. Please try again.");
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
    <motion.div
      variants={itemVariants}
      initial="hidden"
      animate="visible"
      transition={{ delay: 0.3 }}
      className="w-full"
    >
      <div className="imperial-card p-7 sm:p-9">
        <div className="mb-6 text-center">
          <span className="text-gold text-sm">❖</span>
          <h2 className="font-display text-foreground mt-2 text-xs tracking-[0.3em] sm:text-sm">
            LOOKUP
          </h2>
          <div className="gold-line mx-auto mt-3 max-w-12" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
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
                  className="border-red-200/50 bg-red-50/80 dark:border-red-800/50 dark:bg-red-950/30"
                >
                  <Info className="h-4 w-4" />
                  <AlertTitle className="text-red-800 dark:text-red-200">
                    Search Error
                  </AlertTitle>
                  <AlertDescription className="text-red-700 dark:text-red-300">
                    {error}
                  </AlertDescription>
                </Alert>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-2">
            <span className="text-foreground/60 font-display block text-[0.65rem] tracking-[0.2em] uppercase">
              Search By
            </span>
            <div className="border-gold/20 bg-gold/5 dark:bg-gold/10 grid grid-cols-2 gap-1.5 border p-1.5">
              <button
                type="button"
                onClick={() => {
                  setSearchMethod("username");
                  setError("");
                }}
                className={cn(
                  "flex items-center justify-center gap-2 py-2.5 text-sm font-semibold transition-all duration-200",
                  searchMethod === "username"
                    ? "border-gold/30 text-gold-dim dark:bg-background dark:text-gold border bg-white shadow-sm"
                    : "text-foreground/50 hover:text-foreground/70 dark:text-foreground/50 dark:hover:text-foreground/70",
                )}
              >
                <User className="h-4 w-4" />
                Username
              </button>
              <button
                type="button"
                onClick={() => {
                  setSearchMethod("userid");
                  setError("");
                }}
                className={cn(
                  "flex items-center justify-center gap-2 py-2.5 text-sm font-semibold transition-all duration-200",
                  searchMethod === "userid"
                    ? "border-gold/30 text-gold-dim dark:bg-background dark:text-gold border bg-white shadow-sm"
                    : "text-foreground/50 hover:text-foreground/70 dark:text-foreground/50 dark:hover:text-foreground/70",
                )}
              >
                <Hash className="h-4 w-4" />
                User ID
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="searchValue"
              className="text-foreground/60 font-display block text-[0.65rem] tracking-[0.2em] uppercase"
            >
              {searchMethod === "username"
                ? "AniList Username"
                : "AniList User ID"}
            </label>
            <div className="relative">
              <div className="text-foreground/40 pointer-events-none absolute top-1/2 left-4 -translate-y-1/2">
                {searchMethod === "username" ? (
                  <Search className="h-5 w-5" />
                ) : (
                  <Hash className="h-5 w-5" />
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
                className="border-gold/20 placeholder:text-foreground/35 hover:border-gold/40 focus:border-gold focus:ring-gold/20 dark:border-gold/20 dark:bg-background dark:placeholder:text-foreground/35 dark:hover:border-gold/40 dark:focus:border-gold h-13 bg-white pl-12 text-base transition-all focus:ring-2"
                disabled={loading}
              />
            </div>
          </div>

          <Button
            type="submit"
            size="lg"
            className="imperial-btn imperial-btn-fill group h-13 w-full text-base disabled:opacity-70 disabled:hover:scale-100"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Opening user page...
              </>
            ) : (
              <>
                <Search className="mr-2 h-5 w-5" />
                Search User
                <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
              </>
            )}
          </Button>
        </form>

        <p className="font-body-serif text-foreground/40 mt-5 text-center text-xs leading-relaxed">
          Any public AniList profile can be looked up by username or numeric ID.
        </p>
      </div>
    </motion.div>
  );
}
