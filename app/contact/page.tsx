"use client";

import { motion } from "framer-motion";

import {
  ContactChannels,
  ContactCTA,
  ContactHeroSection,
  ContactReasons,
} from "@/components/contact";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { usePageSEO } from "@/hooks/usePageSEO";
import { fadeUp, lineExpand, VIEWPORT_ONCE } from "@/lib/animations";

export default function ContactPage() {
  usePageSEO("contact");

  return (
    <ErrorBoundary>
      <div className="relative min-h-screen">
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
          initial="hidden"
          whileInView="visible"
          viewport={VIEWPORT_ONCE}
          variants={fadeUp}
        >
          <ContactHeroSection />
        </motion.div>

        {/* Section divider — animated gold fade line */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={VIEWPORT_ONCE}
          variants={lineExpand}
          className="mx-auto h-px max-w-[60%] origin-center bg-linear-to-r from-transparent via-[hsl(var(--gold)/0.2)] to-transparent"
        />

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={VIEWPORT_ONCE}
          variants={fadeUp}
        >
          <ContactChannels />
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={VIEWPORT_ONCE}
          variants={fadeUp}
        >
          <ContactReasons />
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={VIEWPORT_ONCE}
          variants={fadeUp}
        >
          <ContactCTA />
        </motion.div>
      </div>
    </ErrorBoundary>
  );
}
