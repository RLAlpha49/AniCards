"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { User, Hash, ArrowRight, Search, Info, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  trackFormSubmission,
  trackNavigation,
} from "@/lib/utils/google-analytics";

/** Supported lookup modes for the search form. @source */
type SearchMethod = "username" | "userid";

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

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
   * Handles form submission.
   * @param e - The form submission event.
   * @source
   */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(searchValue);
  };

  /**
   * Validates input, tracks analytics, and routes to the targeted user page.
   * @param value - The entered username or AniList user ID.
   * @source
   */
  const performSearch = (value: string) => {
    if (!value.trim()) {
      setError(
        `Please enter a ${searchMethod === "username" ? "username" : "user ID"}`,
      );
      trackFormSubmission("user_search", false);
      return;
    }

    setLoading(true);
    onLoadingChange?.(true);
    trackFormSubmission("user_search", true);

    const params = new URLSearchParams();

    if (searchMethod === "username") {
      params.set("username", value.trim());
    } else {
      params.set("userId", value.trim());
    }

    trackNavigation("user_page", "search_form");
    router.push(`/user?${params.toString()}`);
  };

  return (
    <motion.div
      variants={itemVariants}
      initial="hidden"
      animate="visible"
      transition={{ delay: 0.3 }}
      className="w-full max-w-2xl"
    >
      <div className="rounded-3xl border border-slate-200/50 bg-white/80 p-8 shadow-2xl shadow-slate-200/50 backdrop-blur-xl dark:border-slate-700/50 dark:bg-slate-800/80 dark:shadow-slate-900/50 sm:p-10">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Error Alert */}
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

          {/* Search Method Toggle */}
          <div className="space-y-3">
            <span className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Search By
            </span>
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1.5 dark:bg-slate-700/50">
              <button
                type="button"
                onClick={() => {
                  setSearchMethod("username");
                  setError("");
                }}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all duration-200",
                  searchMethod === "username"
                    ? "bg-white text-blue-600 shadow-md dark:bg-slate-600 dark:text-blue-400"
                    : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
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
                  "flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all duration-200",
                  searchMethod === "userid"
                    ? "bg-white text-blue-600 shadow-md dark:bg-slate-600 dark:text-blue-400"
                    : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
                )}
              >
                <Hash className="h-4 w-4" />
                User ID
              </button>
            </div>
          </div>

          {/* Search Input */}
          <div className="space-y-3">
            <label
              htmlFor="searchValue"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              {searchMethod === "username"
                ? "AniList Username"
                : "AniList User ID"}
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">
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
                  searchMethod === "username"
                    ? "Enter username (e.g., Alpha49)"
                    : "Enter user ID (e.g., 542244)"
                }
                className="h-14 rounded-2xl border-slate-200 bg-white pl-12 text-lg transition-all placeholder:text-slate-400 hover:border-blue-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-700 dark:placeholder:text-slate-500 dark:hover:border-blue-500 dark:focus:border-blue-400"
                disabled={loading}
              />
            </div>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            size="lg"
            className="group h-14 w-full rounded-full bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-lg font-semibold text-white shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-purple-500/25 disabled:opacity-70 disabled:hover:scale-100"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Searching...
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

        {/* Helper text */}
        <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
          Search AniList profiles that already have generated cards (your own or
          a friend's) to view their statistics.
        </p>
      </div>
    </motion.div>
  );
}
