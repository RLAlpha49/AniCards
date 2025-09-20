"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { FileText, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { LoadingSpinner } from "@/components/loading-spinner";
import { usePageSEO } from "@/hooks/use-page-seo";

export default function LicensePage() {
  usePageSEO("license");

  const [licenseText, setLicenseText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLicense = async () => {
      try {
        const response = await fetch(
          "https://raw.githubusercontent.com/RLAlpha49/Anicards/main/LICENSE",
        );

        if (!response.ok)
          throw new Error(`HTTP error! status: ${response.status}`);

        const text = await response.text();
        setLicenseText(text);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load license");
      } finally {
        setIsLoading(false);
      }
    };

    fetchLicense();
  }, []);

  let content: React.ReactNode;
  if (isLoading) {
    content = (
      <div className="flex justify-center p-12">
        <div className="text-center">
          <LoadingSpinner size="lg" className="mb-4 text-blue-500" />
          <p className="text-gray-600 dark:text-gray-400">
            Loading license content...
          </p>
        </div>
      </div>
    );
  } else if (error) {
    content = (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <Alert
          variant="destructive"
          className="border-red-200/50 bg-red-50/80 backdrop-blur-sm dark:border-red-800/50 dark:bg-red-950/30"
        >
          <AlertCircle className="h-4 w-4" />
          <div className="flex items-center justify-between">
            <span className="text-red-800 dark:text-red-200">
              Failed to load license: {error}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.reload()}
              className="ml-4 border-red-300 text-red-700 hover:bg-red-100 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-900"
            >
              🔄 Retry
            </Button>
          </div>
        </Alert>
      </motion.div>
    );
  } else {
    content = (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="rounded-2xl border-2 border-gray-200/50 bg-gradient-to-br from-gray-50 to-gray-100/50 p-6 shadow-inner backdrop-blur-sm dark:border-gray-700/50 dark:from-gray-900 dark:to-gray-800/50"
      >
        <pre className="max-h-96 overflow-auto whitespace-pre-wrap font-mono text-sm leading-relaxed text-gray-700 dark:text-gray-300">
          {licenseText}
        </pre>
      </motion.div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-100 px-4 py-12 dark:from-gray-900 dark:via-slate-800 dark:to-blue-950">
      {/* Background decorative elements */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -right-40 -top-40 h-80 w-80 rounded-full bg-gradient-to-br from-blue-400/20 to-purple-600/20 blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-gradient-to-tr from-pink-400/20 to-orange-600/20 blur-3xl"></div>
      </div>

      <div className="container relative z-10 mx-auto max-w-4xl">
        {/* Animated header section */}
        <motion.header
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="mb-12 text-center"
        >
          <div className="mb-4 inline-flex items-center gap-3 rounded-full bg-gradient-to-r from-green-100 to-blue-100 px-6 py-2 dark:from-green-900/30 dark:to-blue-900/30">
            <div className="h-2 w-2 animate-pulse rounded-full bg-green-500"></div>
            <span className="text-sm font-medium text-green-700 dark:text-green-300">
              Open Source
            </span>
          </div>
          <h1 className="mb-4 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-5xl font-bold text-transparent md:text-6xl">
            Software License
          </h1>
          <motion.p
            className="mx-auto max-w-2xl text-xl leading-relaxed text-gray-600 dark:text-gray-300"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            MIT License - Free and open source software promoting innovation and
            collaboration
          </motion.p>
        </motion.header>

        {/* License content with motion effects */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mx-auto max-w-4xl"
        >
          <div className="rounded-3xl border-2 border-blue-100/50 bg-white/70 p-8 shadow-2xl backdrop-blur-xl dark:border-blue-900/30 dark:bg-gray-800/70">
            <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center space-x-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg">
                  <FileText className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                    MIT License
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Permissive open source license
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <Button
                  asChild
                  variant="outline"
                  className="border-blue-200/50 bg-blue-50/50 transition-all duration-300 hover:scale-105 hover:bg-blue-100/70 dark:border-blue-700/50 dark:bg-blue-950/30 dark:hover:bg-blue-900/50"
                >
                  <Link
                    href="https://github.com/RLAlpha49/Anicards/blob/main/LICENSE"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    📄 View on GitHub
                  </Link>
                </Button>
                <Button
                  asChild
                  className="bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg transition-all duration-200 hover:scale-105 hover:from-purple-700 hover:to-pink-700 hover:shadow-xl"
                >
                  <Link
                    href="https://opensource.org/licenses/MIT"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    🔗 Learn More
                  </Link>
                </Button>
              </div>
            </div>

            {content}

            {/* Additional Information */}
            {!isLoading && !error && (
              <motion.div
                className="mt-8 grid gap-6 md:grid-cols-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.5 }}
              >
                <div className="rounded-2xl border border-green-200/50 bg-gradient-to-r from-green-50 to-emerald-50 p-6 dark:border-green-800/50 dark:from-green-950/20 dark:to-emerald-950/20">
                  <h3 className="mb-3 flex items-center gap-2 font-bold text-green-800 dark:text-green-200">
                    <span className="text-xl">✅</span>
                    <span>What You Can Do</span>
                  </h3>
                  <ul className="space-y-2 text-sm text-green-700 dark:text-green-300">
                    <li>• Use this software commercially</li>
                    <li>• Modify and distribute the code</li>
                    <li>• Use it privately for any purpose</li>
                    <li>• Include it in larger works</li>
                  </ul>
                </div>

                <div className="rounded-2xl border border-orange-200/50 bg-gradient-to-r from-orange-50 to-yellow-50 p-6 dark:border-orange-800/50 dark:from-orange-950/20 dark:to-yellow-950/20">
                  <h3 className="mb-3 flex items-center gap-2 font-bold text-orange-800 dark:text-orange-200">
                    <span className="text-xl">⚠️</span>
                    <span>Requirements</span>
                  </h3>
                  <ul className="space-y-2 text-sm text-orange-700 dark:text-orange-300">
                    <li>• Include the original license</li>
                    <li>• Include the copyright notice</li>
                    <li>• Document any significant changes</li>
                  </ul>
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* Call to Action */}
        <motion.div
          className="mt-12 text-center"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
        >
          <div className="rounded-2xl border border-gray-200/50 bg-gradient-to-r from-blue-50/50 via-purple-50/50 to-pink-50/50 p-6 backdrop-blur-sm dark:border-gray-700/50 dark:from-blue-950/20 dark:via-purple-950/20 dark:to-pink-950/20">
            <p className="text-lg text-gray-600 dark:text-gray-300">
              <span className="font-semibold">🚀 Open Source:</span> AniCards is
              free and open source.
              <br className="hidden sm:block" />
              Contributions, feedback, and suggestions are always welcome!
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
