"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import PageShell from "@/components/page-shell";
import {
  FileText,
  AlertCircle,
  Scale,
  ShieldCheck,
  Heart,
  Copy,
  Check,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { LoadingSpinner } from "@/components/loading-spinner";
import { usePageSEO } from "@/hooks/use-page-seo";
import { SimpleGithubIcon } from "@/components/simple-icons";
import HeroHighlights from "@/components/hero-highlights";
import HeroBadge from "@/components/hero-badge";

/**
 * License benefits/features highlights.
 * @source
 */
const LICENSE_HIGHLIGHTS = [
  {
    icon: ShieldCheck,
    title: "Free to Use",
    description: "Use AniCards in any project, personal or commercial",
    bgLight: "bg-green-100 dark:bg-green-900/30",
    textColor: "text-green-600 dark:text-green-400",
  },
  {
    icon: Scale,
    title: "Permissive",
    description: "Modify, distribute, and sublicense as needed",
    bgLight: "bg-blue-100 dark:bg-blue-900/30",
    textColor: "text-blue-600 dark:text-blue-400",
  },
  {
    icon: Heart,
    title: "Open Source",
    description: "Contribute back to the community if you'd like",
    bgLight: "bg-pink-100 dark:bg-pink-900/30",
    textColor: "text-pink-600 dark:text-pink-400",
  },
];

/**
 * Renders the license page with animated accents, remote text fetch, and copy controls.
 * @returns {JSX.Element} The composed MIT license layout.
 * @source
 */
export default function LicensePage() {
  usePageSEO("license");

  const [licenseText, setLicenseText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    /**
     * Retrieves the raw MIT license text from the repository and stores it locally.
     * @source
     */
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

  /**
   * Copies the loaded license text to the clipboard and toggles the copied state.
   * @returns {Promise<void>} Resolves once the clipboard write is attempted.
   * @source
   */
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(licenseText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  /**
   * Selects the license card body for loading, error, or ready states.
   * @returns {React.ReactNode} The content rendered inside the display card.
   * @source
   */
  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-24">
          <LoadingSpinner size="lg" className="mb-4 text-blue-500" />
          <p className="text-slate-500 dark:text-slate-400">
            Fetching license details...
          </p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="p-8">
          <Alert
            variant="destructive"
            className="border-red-200/50 bg-red-50/80 dark:border-red-800/50 dark:bg-red-950/30"
          >
            <AlertCircle className="h-4 w-4" />
            <AlertTitle className="text-red-800 dark:text-red-200">
              Error Loading License
            </AlertTitle>
            <AlertDescription className="flex items-center justify-between text-red-700 dark:text-red-300">
              <span>{error}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => globalThis.location.reload()}
                className="ml-4 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20"
              >
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      );
    }

    return (
      <div className="group relative">
        <div className="absolute left-0 top-0 h-full w-1 rounded-l-lg bg-gradient-to-b from-blue-500 via-purple-500 to-pink-500" />
        <pre className="overflow-x-auto whitespace-pre-wrap rounded-2xl bg-slate-50 p-6 font-mono text-sm leading-relaxed text-slate-700 dark:bg-slate-900/50 dark:text-slate-300 sm:p-8 sm:text-base">
          {licenseText}
        </pre>
      </div>
    );
  };

  return (
    <PageShell
      badge={
        <HeroBadge
          icon={Scale}
          className="border-green-200/50 bg-green-50/80 text-green-700 dark:border-green-700/50 dark:bg-green-950/50 dark:text-green-300"
        >
          Open Source
        </HeroBadge>
      }
      title={
        <>
          Software{" "}
          <span className="relative">
            <span className="relative z-10 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              License
            </span>
            <motion.span
              className="absolute -inset-1 -z-10 block rounded-lg bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-pink-600/20 blur-xl"
              animate={{ opacity: [0.5, 0.8, 0.5] }}
              transition={{ duration: 3, repeat: Infinity }}
            />
          </span>
        </>
      }
      subtitle={
        "AniCards is free and open source software released under the MIT License."
      }
      heroContent={
        <HeroHighlights
          items={LICENSE_HIGHLIGHTS}
          className="mt-10 grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3"
        />
      }
    >
      {/* License Content Section */}
      <section className="relative w-full overflow-hidden pb-16 lg:pb-24">
        <div className="container relative mx-auto px-4">
          <div className="mx-auto max-w-4xl">
            {/* License Card */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <div className="overflow-hidden rounded-3xl border border-slate-200/50 bg-white/80 shadow-xl shadow-slate-200/50 backdrop-blur-sm dark:border-slate-700/50 dark:bg-slate-800/80 dark:shadow-slate-900/50">
                {/* Card Header */}
                <div className="flex flex-col gap-4 border-b border-slate-200/50 bg-slate-50/50 px-6 py-5 dark:border-slate-700/50 dark:bg-slate-900/50 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/50">
                      <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                        MIT License
                      </h2>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Permissive free software license
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={copyToClipboard}
                      disabled={isLoading || !!error}
                      className="rounded-full"
                    >
                      {copied ? (
                        <>
                          <Check className="mr-2 h-4 w-4 text-green-500" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="mr-2 h-4 w-4" />
                          Copy
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      asChild
                      className="hidden rounded-full sm:flex"
                    >
                      <Link
                        href="https://github.com/RLAlpha49/Anicards/blob/main/LICENSE"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <SimpleGithubIcon className="mr-2 h-4 w-4" />
                        GitHub
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      asChild
                      className="rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700"
                    >
                      <Link
                        href="https://opensource.org/licenses/MIT"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Official Definition
                        <ExternalLink className="ml-2 h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </div>
                </div>

                {/* Card Content */}
                <div className="p-6 sm:p-8">{renderContent()}</div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
