"use client";

import { motion } from "framer-motion";
import {
  ArrowRight,
  Layers,
  Palette,
  Search,
  Share2,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LoadingOverlay } from "@/components/LoadingSpinner";
import { SearchForm } from "@/components/search/SearchForm";
import { usePageSEO } from "@/hooks/usePageSEO";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.15 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const },
  },
};

const JOURNEY_STEPS = [
  {
    num: "Ⅰ",
    title: "SEARCH",
    desc: "Enter any AniList username or user ID. We'll find the profile instantly.",
    icon: Search,
  },
  {
    num: "Ⅱ",
    title: "GENERATE",
    desc: "Your stats are transformed into beautifully crafted visual cards automatically.",
    icon: Sparkles,
  },
  {
    num: "Ⅲ",
    title: "CUSTOMIZE",
    desc: "Fine-tune colors, layouts, and styles until every card feels unmistakably yours.",
    icon: Palette,
  },
];

const CAPABILITIES = [
  {
    icon: Layers,
    title: "MULTIPLE CARD TYPES",
    desc: "From activity stats to genre breakdowns, favorites, and social metrics — every facet of your profile, visualized.",
  },
  {
    icon: Palette,
    title: "RICH THEMES",
    desc: "Choose from curated color palettes or craft your own. Dark, light, vibrant, or minimal — your aesthetic, your rules.",
  },
  {
    icon: Share2,
    title: "EXPORT ANYWHERE",
    desc: "SVG and PNG output that renders flawlessly on GitHub readmes, social profiles, forums, and everywhere in between.",
  },
];

export default function UserSearchPage() {
  usePageSEO("search");

  const [loading, setLoading] = useState(false);

  return (
    <ErrorBoundary
      resetKeys={[loading ? "loading" : "idle"]}
      onReset={() => setLoading(false)}
    >
      <div className="relative min-h-screen">
        {loading && <LoadingOverlay text="Searching for user..." />}

        <div
          className="pointer-events-none absolute inset-0 opacity-30 dark:opacity-20"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0L60 30L30 60L0 30Z' fill='none' stroke='%23c9a84c15' stroke-width='1'/%3E%3C/svg%3E")`,
          }}
        />

        <section className="relative overflow-hidden px-6 pt-24 pb-20 sm:px-12 md:pt-32 md:pb-28">
          <motion.div
            className="text-gold/10 pointer-events-none absolute top-20 left-[10%] text-6xl select-none"
            animate={{ y: [0, -12, 0], rotate: [0, 8, 0] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          >
            ◇
          </motion.div>
          <motion.div
            className="text-gold/8 pointer-events-none absolute right-[12%] bottom-24 text-4xl select-none"
            animate={{ y: [0, 10, 0], rotate: [0, -6, 0] }}
            transition={{
              duration: 7,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 2,
            }}
          >
            ◇
          </motion.div>
          <motion.div
            className="text-gold/6 pointer-events-none absolute top-[40%] right-[5%] hidden text-3xl select-none md:block"
            animate={{ y: [0, -8, 0] }}
            transition={{
              duration: 6,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 1,
            }}
          >
            ✦
          </motion.div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="relative z-10 mx-auto max-w-5xl"
          >
            <div className="flex flex-col items-center gap-16 lg:flex-row lg:items-start lg:gap-20">
              <div className="flex-1 text-center lg:pt-8 lg:text-left">
                <motion.div
                  variants={itemVariants}
                  className="gold-ornament mb-8 lg:justify-start"
                >
                  <span className="text-gold text-xl">❖</span>
                </motion.div>

                <motion.p
                  variants={itemVariants}
                  className="text-gold mb-5 text-xs tracking-[0.5em] uppercase sm:text-sm"
                >
                  User Discovery
                </motion.p>

                <motion.h1
                  variants={itemVariants}
                  className="font-display text-foreground mb-6 text-4xl leading-[1.1] font-black sm:text-5xl md:text-6xl"
                >
                  FIND ANY
                  <br />
                  <span className="text-gold">ANILIST PROFILE</span>
                </motion.h1>

                <motion.div
                  variants={itemVariants}
                  className="gold-line-thick mx-auto mb-6 max-w-25 lg:mx-0"
                />

                <motion.p
                  variants={itemVariants}
                  className="font-body-serif text-foreground/55 max-w-md text-base leading-relaxed sm:text-lg lg:max-w-sm"
                >
                  Enter a username or user ID to view and customize stat cards.
                  We&apos;ll fetch the data and set everything up automatically.
                </motion.p>

                <motion.div
                  variants={itemVariants}
                  className="text-foreground/35 mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs tracking-wider uppercase lg:justify-start"
                >
                  <span>✦ Instant Lookup</span>
                  <span>✦ No Login Required</span>
                  <span>✦ Auto Setup</span>
                </motion.div>
              </div>

              <motion.div
                variants={itemVariants}
                className="w-full max-w-lg shrink-0 lg:w-105"
              >
                <SearchForm onLoadingChange={setLoading} />
              </motion.div>
            </div>
          </motion.div>
        </section>

        <div className="gold-line-thick mx-auto max-w-[60%]" />

        <section className="px-6 py-16 sm:px-12 md:py-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6 }}
            className="mb-14 text-center"
          >
            <div className="gold-ornament mb-6">
              <span className="text-gold text-base">❖</span>
            </div>
            <h2 className="font-display text-foreground mb-3 text-2xl tracking-[0.15em] sm:text-3xl">
              THE JOURNEY
            </h2>
            <p className="font-body-serif text-foreground/45 mx-auto max-w-md text-sm leading-relaxed sm:text-base">
              Three simple steps from search to a fully customized card
              collection.
            </p>
          </motion.div>

          <div className="mx-auto grid max-w-4xl grid-cols-1 gap-8 md:grid-cols-3">
            {JOURNEY_STEPS.map((step, i) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{
                  duration: 0.5,
                  delay: i * 0.12,
                  ease: [0.22, 1, 0.36, 1],
                }}
                whileHover={{
                  y: -6,
                  borderColor: "hsl(42 63% 55% / 0.45)",
                  transition: { duration: 0.25 },
                }}
                className="imperial-card text-center"
              >
                <span className="font-display text-gold mb-4 block text-4xl">
                  {step.num}
                </span>
                <step.icon className="text-gold/60 mx-auto mb-4 h-6 w-6" />
                <h3 className="font-display text-foreground mb-3 text-sm tracking-[0.25em]">
                  {step.title}
                </h3>
                <div className="gold-line mx-auto mb-3 max-w-10" />
                <p className="font-body-serif text-foreground/50 text-sm leading-relaxed">
                  {step.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </section>

        <div className="gold-line mx-auto max-w-[40%]" />

        <section className="px-6 py-16 sm:px-12 md:py-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6 }}
            className="mb-14 text-center"
          >
            <p className="text-gold mb-4 text-xs tracking-[0.5em] uppercase sm:text-sm">
              What Awaits
            </p>
            <h2 className="font-display text-foreground mb-3 text-2xl tracking-[0.15em] sm:text-3xl">
              CRAFT YOUR COLLECTION
            </h2>
            <div className="gold-line-thick mx-auto mt-4 max-w-20" />
          </motion.div>

          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-10 md:grid-cols-3">
            {CAPABILITIES.map((cap, i) => (
              <motion.div
                key={cap.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: i * 0.12 }}
                whileHover={{ y: -4, transition: { duration: 0.25 } }}
                className="group text-center"
              >
                <div className="border-gold/15 bg-gold/5 group-hover:border-gold/30 mx-auto mb-5 flex h-14 w-14 items-center justify-center border-2 transition-colors">
                  <cap.icon className="text-gold h-6 w-6" />
                </div>
                <h3 className="font-display text-foreground mb-3 text-sm tracking-[0.2em]">
                  {cap.title}
                </h3>
                <p className="font-body-serif text-foreground/50 mx-auto max-w-xs text-sm leading-relaxed">
                  {cap.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </section>

        <section className="border-gold/20 border-y-2 px-6 py-16 text-center sm:px-12 md:py-20">
          <div className="gold-ornament mb-6">
            <span className="text-gold text-base">❖</span>
          </div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="font-display text-gold mb-4 text-3xl sm:text-4xl">
              EXPLORE THE COLLECTION
            </h2>
            <p className="font-body-serif text-foreground/40 mb-8 text-sm sm:text-base">
              See what others have created. Browse real stat cards and find
              inspiration.
            </p>
            <Link href="/examples" className="imperial-btn imperial-btn-fill">
              <span className="inline-flex items-center gap-2">
                View Examples
                <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          </motion.div>
        </section>
      </div>
    </ErrorBoundary>
  );
}
