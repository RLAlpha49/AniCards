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

import {
  safeTrack,
  trackExternalLinkClick,
} from "@/lib/utils/google-analytics";

const REASONS = [
  {
    icon: MessageSquare,
    title: "General Questions",
    description: "Anything about AniCards, usage, or features",
    numeral: "01",
  },
  {
    icon: Lightbulb,
    title: "Feature Requests",
    description: "Ideas for new cards, designs, or improvements",
    numeral: "02",
  },
  {
    icon: Bug,
    title: "Bug Reports",
    description:
      "Something broken? Open an issue on GitHub and I'll look into it",
    href: "https://github.com/RLAlpha49/AniCards/issues",
    numeral: "03",
  },
  {
    icon: Sparkles,
    title: "Collaboration",
    description: "Partnerships, integrations, or creative projects",
    numeral: "04",
  },
];

const staggerList = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 },
  },
};

const listItem = {
  hidden: { opacity: 0, x: -24 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export function ContactReasons() {
  return (
    <section className="border-gold/20 border-y-2 px-6 py-16 sm:px-12 md:py-24">
      <div className="mx-auto max-w-5xl">
        {/* Section heading */}
        <div className="mb-14 text-center">
          <h2 className="font-display text-foreground mb-3 text-sm tracking-[0.3em] uppercase">
            What Can I Help With?
          </h2>
          <div className="gold-line mx-auto max-w-12" />
        </div>

        {/* Reasons list — numbered editorial style */}
        <motion.div
          variants={staggerList}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          className="space-y-0 divide-y divide-[hsl(var(--gold)/0.1)]"
        >
          {REASONS.map((reason) => {
            const inner = (
              <div className="group flex items-start gap-5 py-7 transition-colors sm:items-center sm:gap-8">
                {/* Numeral */}
                <span className="font-display text-gold/20 group-hover:text-gold/50 hidden min-w-12 text-right text-2xl transition-colors sm:block">
                  {reason.numeral}
                </span>

                {/* Icon */}
                <div className="border-gold/15 group-hover:border-gold/35 shrink-0 border p-3 transition-colors">
                  <reason.icon size={18} className="text-gold" />
                </div>

                {/* Copy */}
                <div className="min-w-0 flex-1">
                  <h3 className="font-display text-foreground mb-1 text-xs tracking-[0.2em] uppercase sm:text-sm">
                    {reason.title}
                  </h3>
                  <p className="font-body-serif text-foreground/45 text-sm leading-relaxed">
                    {reason.description}
                  </p>
                </div>

                {/* Action hint for linked items */}
                {reason.href && (
                  <span className="text-gold/50 group-hover:text-gold hidden shrink-0 items-center gap-1.5 text-xs tracking-wider uppercase transition-colors sm:flex">
                    Open an Issue on GitHub
                    <ExternalLink className="h-3.5 w-3.5" />
                  </span>
                )}
              </div>
            );

            return (
              <motion.div key={reason.title} variants={listItem}>
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
                    className="block"
                  >
                    {inner}
                  </Link>
                ) : (
                  inner
                )}
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
