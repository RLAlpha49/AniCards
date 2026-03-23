"use client";

import { motion } from "framer-motion";
import { useState } from "react";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LoadingOverlay } from "@/components/LoadingSpinner";
import {
  SearchCapabilities,
  SearchCTA,
  SearchHeroSection,
  SearchJourney,
} from "@/components/search";
import { fadeUp, lineExpand, VIEWPORT_ONCE } from "@/lib/animations";

export default function SearchPageClient() {
  const [loading, setLoading] = useState(false);

  return (
    <ErrorBoundary
      resetKeys={[loading ? "loading" : "idle"]}
      onReset={() => setLoading(false)}
    >
      <div className="relative min-h-screen">
        {loading && <LoadingOverlay text="Tracking down that profile..." />}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          className="pointer-events-none absolute inset-0 opacity-30 dark:hidden"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0L60 30L30 60L0 30Z' fill='none' stroke='%23a67c1a2e' stroke-width='1'/%3E%3C/svg%3E")`,
          }}
        />
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.3 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          className="pointer-events-none absolute inset-0 hidden opacity-20 dark:block"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0L60 30L30 60L0 30Z' fill='none' stroke='%23c9a84c15' stroke-width='1'/%3E%3C/svg%3E")`,
          }}
        />

        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={VIEWPORT_ONCE}
        >
          <SearchHeroSection onLoadingChange={setLoading} />
        </motion.div>

        <motion.div
          variants={lineExpand}
          initial="hidden"
          whileInView="visible"
          viewport={VIEWPORT_ONCE}
          style={{ originX: 0.5 }}
          className="gold-line-thick mx-auto max-w-[60%]"
        />

        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={VIEWPORT_ONCE}
        >
          <SearchJourney />
        </motion.div>

        <motion.div
          variants={lineExpand}
          initial="hidden"
          whileInView="visible"
          viewport={VIEWPORT_ONCE}
          style={{ originX: 0.5 }}
          className="gold-line mx-auto max-w-[40%]"
        />

        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={VIEWPORT_ONCE}
        >
          <SearchCapabilities />
        </motion.div>

        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={VIEWPORT_ONCE}
        >
          <SearchCTA />
        </motion.div>
      </div>
    </ErrorBoundary>
  );
}
