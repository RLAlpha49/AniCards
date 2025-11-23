"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  FileText,
  AlertCircle,
  Sparkles,
  ArrowRight,
  Scale,
  ShieldCheck,
  Copyright,
  FileCode,
  Copy,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { LoadingSpinner } from "@/components/loading-spinner";
import { usePageSEO } from "@/hooks/use-page-seo";
import { Card, CardContent } from "@/components/ui/card";
import { SimpleGithubIcon } from "@/components/icons/simple-icons";

const FLOATING_ICONS = [
  {
    id: "scale",
    icon: Scale,
    className:
      "absolute top-[15%] left-[10%] text-blue-500/10 dark:text-blue-400/10 h-24 w-24 -rotate-12",
    animate: { y: [0, -20, 0], rotate: [-12, -10, -12] },
    delay: 0,
  },
  {
    id: "shield",
    icon: ShieldCheck,
    className:
      "absolute top-[25%] right-[10%] text-purple-500/10 dark:text-purple-400/10 h-32 w-32 rotate-12",
    animate: { y: [0, 20, 0], rotate: [12, 14, 12] },
    delay: 0.5,
  },
  {
    id: "file",
    icon: FileCode,
    className:
      "absolute bottom-[20%] left-[5%] text-pink-500/10 dark:text-pink-400/10 h-20 w-20 rotate-6",
    animate: { y: [0, -15, 0], rotate: [6, 4, 6] },
    delay: 1,
  },
  {
    id: "copyright",
    icon: Copyright,
    className:
      "absolute bottom-[30%] right-[15%] text-indigo-500/10 dark:text-indigo-400/10 h-16 w-16 -rotate-6",
    animate: { y: [0, 15, 0], rotate: [-6, -8, -6] },
    delay: 1.5,
  },
];

export default function LicensePage() {
  usePageSEO("license");

  const [licenseText, setLicenseText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(licenseText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-24">
          <LoadingSpinner size="lg" className="mb-4 text-blue-500" />
          <p className="text-gray-500 dark:text-gray-400">
            Fetching license details...
          </p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="p-8">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error Loading License</AlertTitle>
            <AlertDescription className="flex items-center justify-between">
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
        <div className="absolute right-4 top-4 z-10 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            size="sm"
            variant="outline"
            onClick={copyToClipboard}
            className="bg-white/80 backdrop-blur-sm dark:bg-gray-800/80"
          >
            {copied ? (
              <>
                <Check className="mr-2 h-4 w-4 text-green-500" />
                Copied
              </>
            ) : (
              <>
                <Copy className="mr-2 h-4 w-4" />
                Copy Text
              </>
            )}
          </Button>
        </div>
        <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-blue-500 via-purple-500 to-pink-500" />
        <pre className="overflow-x-auto whitespace-pre-wrap bg-slate-50 p-6 font-mono text-sm leading-relaxed text-slate-700 dark:bg-slate-950/50 dark:text-slate-300 sm:p-8 sm:text-base">
          {licenseText}
        </pre>
      </div>
    );
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* Abstract Background Shapes */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-0 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-400/10 blur-[120px] dark:bg-blue-600/10" />
        <div className="absolute bottom-0 left-0 h-[600px] w-[600px] rounded-full bg-purple-400/10 blur-[100px] dark:bg-purple-600/10" />
        <div className="absolute bottom-0 right-0 h-[600px] w-[600px] rounded-full bg-pink-400/10 blur-[100px] dark:bg-pink-600/10" />
      </div>

      {/* Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:24px_24px]" />

      {/* Floating Icons */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        {FLOATING_ICONS.map((item) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{
              opacity: 1,
              scale: 1,
              ...item.animate,
            }}
            transition={{
              opacity: { duration: 0.8, delay: item.delay },
              scale: { duration: 0.8, delay: item.delay },
              default: { duration: 6, repeat: Infinity, ease: "easeInOut" },
            }}
            className={item.className}
          >
            <item.icon className="h-full w-full" />
          </motion.div>
        ))}
      </div>

      <div className="container relative z-10 mx-auto max-w-5xl px-4 py-12">
        {/* Header Section */}
        <div className="mb-12 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-6 inline-flex items-center rounded-full border border-blue-200 bg-blue-50/80 px-4 py-1.5 text-sm font-medium text-blue-600 backdrop-blur-sm dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            <span>Open Source</span>
          </motion.div>

          <motion.h1
            className="mb-6 text-4xl font-extrabold leading-tight tracking-tight text-slate-900 dark:text-white sm:text-5xl md:text-6xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            Software{" "}
            <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              License
            </span>
          </motion.h1>

          <motion.p
            className="mx-auto max-w-2xl text-lg text-slate-600 dark:text-slate-400"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            AniCards is free and open source software released under the MIT
            License. We believe in transparency and collaboration.
          </motion.p>
        </div>

        {/* Main Content Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mx-auto w-fit"
        >
          <Card className="overflow-hidden border-gray-200 bg-white/80 shadow-2xl backdrop-blur-xl dark:border-gray-800 dark:bg-gray-900/80">
            <div className="border-b border-gray-100 bg-gray-50/50 px-6 py-4 dark:border-gray-800 dark:bg-gray-900/50">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      MIT License
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Permissive free software license
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="hidden sm:flex"
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
                    className="bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700"
                  >
                    <Link
                      href="https://opensource.org/licenses/MIT"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Official Definition
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>

            <CardContent className="p-0">{renderContent()}</CardContent>
          </Card>
        </motion.div>

        {/* Footer Note */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="mt-12 text-center"
        >
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Copyright &copy; {new Date().getFullYear()} AniCards. All rights
            reserved.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
