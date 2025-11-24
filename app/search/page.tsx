"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Info, User, Hash, Sparkles, ArrowRight, Search } from "lucide-react";
import { LoadingOverlay } from "@/components/loading-spinner";
import { FloatingCardsLayer } from "@/components/ui/floating-cards";
import {
  trackFormSubmission,
  trackNavigation,
} from "@/lib/utils/google-analytics";
import { usePageSEO } from "@/hooks/use-page-seo";
import { cn } from "@/lib/utils";
import { GridPattern } from "../../components/ui/grid-pattern";

type SearchMethod = "username" | "userid";

export default function UserLookupPage() {
  usePageSEO("search");

  const router = useRouter();
  const [searchMethod, setSearchMethod] = useState<SearchMethod>("username");
  const [searchValue, setSearchValue] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(searchValue);
  };

  const performSearch = (value: string) => {
    if (!value.trim()) {
      setError(
        `Please enter a ${searchMethod === "username" ? "username" : "user ID"}`,
      );
      trackFormSubmission("user_search", false);
      return;
    }

    setLoading(true);
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
    <div className="relative h-full w-full overflow-hidden bg-slate-50 dark:bg-slate-950">
      {loading && <LoadingOverlay text="Searching for user..." />}

      <GridPattern className="z-0" includeGradients={true} />

      {/* Floating Cards Layer */}
      <FloatingCardsLayer layout="search" />

      <div className="container relative z-10 mx-auto flex h-full flex-col items-center justify-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8 inline-flex items-center rounded-full border border-blue-200 bg-blue-50/80 px-4 py-1.5 text-sm font-medium text-blue-600 backdrop-blur-sm dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
        >
          <Sparkles className="mr-2 h-4 w-4" />
          <span>Find Any AniList User</span>
        </motion.div>

        <motion.h1
          className="mb-12 text-center text-4xl font-extrabold leading-tight tracking-tight text-slate-900 dark:text-white sm:text-5xl md:text-6xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          Discover User{" "}
          <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
            Statistics
          </span>
        </motion.h1>

        <motion.div
          className="w-full max-w-lg"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card className="border-gray-200 bg-white/80 shadow-2xl backdrop-blur-xl dark:border-gray-800 dark:bg-gray-900/80">
            <CardHeader>
              <CardTitle>Search Profile</CardTitle>
              <CardDescription>Enter a username or ID</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
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

                {/* Search Method Toggle */}
                <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setSearchMethod("username");
                      setError("");
                    }}
                    className={cn(
                      "flex items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-all",
                      searchMethod === "username"
                        ? "bg-white text-blue-600 shadow-sm dark:bg-slate-700 dark:text-blue-400"
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
                      "flex items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-all",
                      searchMethod === "userid"
                        ? "bg-white text-blue-600 shadow-sm dark:bg-slate-700 dark:text-blue-400"
                        : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
                    )}
                  >
                    <Hash className="h-4 w-4" />
                    User ID
                  </button>
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="searchValue"
                    className="text-base font-semibold text-gray-900 dark:text-gray-100"
                  >
                    {searchMethod === "username" ? "Username" : "User ID"}
                  </Label>
                  <div className="relative">
                    <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">
                      {searchMethod === "username" ? (
                        <Search className="h-5 w-5" />
                      ) : (
                        <Hash className="h-5 w-5" />
                      )}
                    </div>
                    <Input
                      id="searchValue"
                      value={searchValue}
                      onChange={(e) => setSearchValue(e.target.value)}
                      placeholder={
                        searchMethod === "username"
                          ? "e.g., YourUsername"
                          : "e.g., 123456"
                      }
                      className="h-12 border-gray-200 bg-white pl-10 text-lg transition-all hover:border-blue-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-500 dark:focus:border-blue-400"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  size="lg"
                  className="group h-14 w-full rounded-full bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-lg font-semibold text-white shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-blue-500/25 disabled:opacity-50"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white"></div>
                      Searching...
                    </>
                  ) : (
                    <>
                      <span>Search User Stats</span>
                      <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
