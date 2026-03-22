"use client";

import { motion } from "framer-motion";
import {
  Bug,
  ExternalLink,
  Lightbulb,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

import { EASE_OUT_EXPO } from "@/lib/animations";
import {
  safeTrack,
  trackExternalLinkClick,
} from "@/lib/utils/google-analytics";

const REASONS = [
  {
    icon: MessageSquare,
    title: "Just Curious",
    description:
      "Wondering how AniCards works, what it can do, or something else entirely",
  },
  {
    icon: Lightbulb,
    title: "Got an Idea",
    description:
      "Dream up a new card type, suggest a fresh look, or pitch something unexpected",
  },
  {
    icon: Bug,
    title: "Something's Off",
    description:
      "Ran into a bug? Let me know — or open an issue directly on GitHub",
    href: "https://github.com/RLAlpha49/AniCards/issues",
  },
  {
    icon: Sparkles,
    title: "Let's Build",
    description: "Partnerships, integrations, or whatever you're cooking up",
  },
];

const container = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.15 },
  },
};

const card = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.55,
      ease: [0.22, 1, 0.36, 1] as const,
      staggerChildren: 0.06,
      delayChildren: 0.15,
    },
  },
};

const cardChild = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export function ContactReasons() {
  return (
    <section className="px-6 py-16 sm:px-12 md:py-24">
      <div className="mx-auto max-w-5xl">
        {/* Section heading */}
        <div className="mb-14 text-center">
          <span
            className="text-[10px] tracking-[0.5em] uppercase"
            style={{
              fontFamily: "var(--font-geist-mono), monospace",
              color: "hsl(var(--gold) / 0.4)",
            }}
          >
            What Brings You Here
          </span>
          <h2 className="
            mt-3 font-display text-2xl font-bold tracking-tight text-foreground
            sm:text-3xl
          ">
            WHAT&apos;S ON YOUR MIND?
          </h2>
          <div className="
            mx-auto mt-5 h-px max-w-16 bg-linear-to-r from-transparent via-[hsl(var(--gold)/0.4)]
            to-transparent
          " />
        </div>

        {/* Reasons grid */}
        <motion.div
          variants={container}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          className="grid gap-4 sm:grid-cols-2"
        >
          {REASONS.map((reason, i) => {
            const content = (
              <motion.div
                variants={card}
                className="
                  group relative flex h-full flex-col border border-[hsl(var(--gold)/0.08)]
                  bg-[hsl(var(--gold)/0.015)] p-6 transition-all duration-300
                  hover:border-[hsl(var(--gold)/0.25)] hover:bg-[hsl(var(--gold)/0.03)]
                  sm:p-8
                "
              >
                {/* Numbered corner */}
                <span
                  className="absolute top-4 right-5 text-[10px] tracking-wider"
                  style={{
                    fontFamily: "var(--font-geist-mono), monospace",
                    color: "hsl(var(--gold) / 0.15)",
                  }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>

                <motion.div variants={cardChild}>
                  <reason.icon
                    size={20}
                    className="mb-5 text-gold/50 transition-colors group-hover:text-gold"
                    strokeWidth={1.5}
                  />
                </motion.div>

                <motion.h3
                  variants={cardChild}
                  className="
                    mb-2 font-display text-xs tracking-[0.2em] text-foreground uppercase
                    sm:text-sm
                  "
                >
                  {reason.title}
                </motion.h3>
                <motion.p
                  variants={cardChild}
                  className="font-body-serif text-sm/relaxed text-foreground/40"
                >
                  {reason.description}
                </motion.p>

                {reason.href && (
                  <motion.div
                    variants={cardChild}
                    className="
                      mt-5 flex items-center gap-1.5 text-xs tracking-wider text-gold/40 uppercase
                      transition-colors
                      group-hover:text-gold
                    "
                  >
                    Open Issue
                    <ExternalLink className="size-3" />
                  </motion.div>
                )}
              </motion.div>
            );

            return (
              <motion.div
                key={reason.title}
                variants={card}
                whileHover={{
                  y: -3,
                  transition: { duration: 0.3, ease: EASE_OUT_EXPO },
                }}
              >
                {reason.href ? (
                  <Link
                    href={reason.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() =>
                      safeTrack(() =>
                        trackExternalLinkClick("github_issues", "contact_page"),
                      )
                    }
                    className="block h-full"
                  >
                    {content}
                  </Link>
                ) : (
                  content
                )}
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
