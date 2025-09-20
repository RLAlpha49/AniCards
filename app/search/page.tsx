"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";
import { LoadingOverlay } from "@/components/loading-spinner";
import {
  trackFormSubmission,
  trackNavigation,
} from "@/lib/utils/google-analytics";
import { usePageSEO } from "@/hooks/use-page-seo";

export default function UserLookupPage() {
  usePageSEO("search");

  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!userId && !username) {
      setError("Please enter either a User ID or Username");
      trackFormSubmission("user_search", false);
      return;
    }

    setLoading(true);
    trackFormSubmission("user_search", true);

    const params = new URLSearchParams();
    if (userId) params.set("userId", userId);
    if (username) params.set("username", username);

    trackNavigation("user_page", "search_form");
    router.push(`/user?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-100 px-4 py-12 dark:from-gray-900 dark:via-slate-800 dark:to-blue-950">
      {loading && <LoadingOverlay text="Searching for user..." />}

      {/* Background decorative elements */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -right-40 -top-40 h-80 w-80 rounded-full bg-gradient-to-br from-blue-400/20 to-purple-600/20 blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-gradient-to-tr from-pink-400/20 to-orange-600/20 blur-3xl"></div>
      </div>

      <div className="container relative z-10 mx-auto flex max-w-2xl flex-col items-center justify-center">
        <motion.header
          className="mb-12 text-center"
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <h1 className="mb-4 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-5xl font-bold text-transparent md:text-6xl">
            Find User Cards
          </h1>
        </motion.header>

        <motion.div
          className="w-full max-w-lg"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            type: "spring",
            stiffness: 100,
            damping: 20,
            delay: 0.3,
          }}
        >
          <div className="rounded-3xl border-2 border-blue-100/50 bg-white/70 p-8 shadow-2xl backdrop-blur-xl dark:border-blue-900/30 dark:bg-gray-800/70">
            <form onSubmit={handleSubmit} className="space-y-8">
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

              <div className="space-y-6">
                <motion.div
                  className="space-y-3"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4, duration: 0.4 }}
                >
                  <Label
                    htmlFor="userId"
                    className="flex items-center gap-2 text-lg font-semibold text-gray-700 dark:text-gray-200"
                  >
                    <span className="text-xl">🆔</span>
                    <span>User ID</span>
                  </Label>
                  <Input
                    id="userId"
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    placeholder="Enter numeric AniList ID (e.g., 123456)"
                    className="h-12 border-2 border-blue-100/50 bg-white/50 text-lg transition-all duration-300 placeholder:text-gray-400 hover:border-blue-200/70 focus:border-blue-400/70 focus:bg-white/70 focus:ring-2 focus:ring-blue-200/30 dark:border-blue-800/50 dark:bg-gray-900/50 dark:hover:border-blue-700/70 dark:focus:border-blue-500/70 dark:focus:bg-gray-900/70"
                  />
                </motion.div>

                <motion.div
                  className="flex items-center gap-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5, duration: 0.4 }}
                >
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-300 to-transparent dark:via-gray-600"></div>
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    OR
                  </span>
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-300 to-transparent dark:via-gray-600"></div>
                </motion.div>

                <motion.div
                  className="space-y-3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6, duration: 0.4 }}
                >
                  <div className="flex items-center justify-between">
                    <Label
                      htmlFor="username"
                      className="flex items-center gap-2 text-lg font-semibold text-gray-700 dark:text-gray-200"
                    >
                      <span className="text-xl">👤</span>
                      <span>Username</span>
                    </Label>
                    <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                      Case insensitive
                    </span>
                  </div>
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter AniList username (e.g., YourUsername)"
                    className="h-12 border-2 border-purple-100/50 bg-white/50 text-lg transition-all duration-300 placeholder:text-gray-400 hover:border-purple-200/70 focus:border-purple-400/70 focus:bg-white/70 focus:ring-2 focus:ring-purple-200/30 dark:border-purple-800/50 dark:bg-gray-900/50 dark:hover:border-purple-700/70 dark:focus:border-purple-500/70 dark:focus:bg-gray-900/70"
                  />
                </motion.div>
              </div>

              <motion.div
                className="pt-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7, duration: 0.4 }}
              >
                <Button
                  type="submit"
                  size="lg"
                  className="h-14 w-full transform-gpu rounded-2xl bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-lg font-semibold text-white shadow-lg transition-all duration-200 hover:scale-[1.02] hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 hover:shadow-xl disabled:cursor-not-allowed disabled:from-gray-400 disabled:via-gray-500 disabled:to-gray-600 disabled:hover:scale-100"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white"></div>
                      Searching...
                    </>
                  ) : (
                    <>
                      <span>🔍 Search User Stats</span>
                      <span className="ml-2 transition-transform group-hover:translate-x-1">
                        →
                      </span>
                    </>
                  )}
                </Button>
              </motion.div>
            </form>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
