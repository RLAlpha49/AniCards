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

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      {/* Animated header section */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8 text-center"
      >
        <h1 className="mb-4 inline-block bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-4xl font-bold text-transparent">
          Software License
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-400">
          MIT License - Open Source Initiative
        </p>
      </motion.header>

      {/* License content with motion effects */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="mx-auto max-w-2xl rounded-xl border border-gray-200 bg-white p-6 shadow-lg dark:border-gray-700 dark:bg-gray-800"
      >
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileText className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-semibold">MIT License</h2>
          </div>
          <Button asChild variant="outline">
            <Link
              href="https://github.com/RLAlpha49/Anicards/blob/main/LICENSE"
              target="_blank"
              rel="noopener noreferrer"
            >
              View on GitHub
            </Link>
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center p-8">
            <LoadingSpinner text="Loading license..." />
          </div>
        ) : error ? (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
            <Button
              variant="outline"
              className="ml-4"
              onClick={() => window.location.reload()}
            >
              Retry
            </Button>
          </Alert>
        ) : (
          <pre className="max-w-full overflow-x-auto whitespace-pre-wrap rounded-lg border border-gray-200 bg-gray-50 p-4 font-mono text-sm dark:border-gray-700 dark:bg-gray-900">
            {licenseText}
          </pre>
        )}
      </motion.div>
    </div>
  );
}
