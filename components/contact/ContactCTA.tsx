"use client";

import { motion } from "framer-motion";
import { Send } from "lucide-react";
import Link from "next/link";

import { EASE_OUT_EXPO } from "@/lib/animations";
import {
  safeTrack,
  trackExternalLinkClick,
} from "@/lib/utils/google-analytics";

const ctaContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.08 },
  },
};

const ctaChild = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export function ContactCTA() {
  return (
    <section className="relative px-6 py-20 sm:px-12 md:py-32">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute bottom-0 left-1/2 h-100 w-150 -translate-x-1/2 rounded-full bg-[hsl(var(--gold)/0.04)] blur-[120px]" />
      </div>

      <motion.div
        variants={ctaContainer}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        className="relative z-10 mx-auto max-w-2xl text-center"
      >
        {/* Top ornament */}
        <motion.div
          variants={ctaChild}
          className="mb-10 flex items-center gap-4"
        >
          <div className="h-px flex-1 bg-linear-to-r from-transparent to-[hsl(var(--gold)/0.15)]" />
          <Send className="text-gold/30 h-4 w-4" strokeWidth={1.5} />
          <div className="h-px flex-1 bg-linear-to-l from-transparent to-[hsl(var(--gold)/0.15)]" />
        </motion.div>

        <motion.h2
          variants={ctaChild}
          className="font-display text-foreground mb-3 text-3xl font-bold sm:text-4xl"
        >
          DROP A LINE
        </motion.h2>
        <motion.p
          variants={ctaChild}
          className="font-body-serif text-foreground/35 mb-10 text-base leading-relaxed"
        >
          Some things deserve more than a quick message.
        </motion.p>

        <motion.div
          variants={ctaChild}
          whileHover={{
            scale: 1.04,
            transition: { duration: 0.3, ease: EASE_OUT_EXPO },
          }}
          whileTap={{ scale: 0.97 }}
          className="inline-block"
        >
          <Link
            href="mailto:contact@alpha49.com"
            onClick={() =>
              safeTrack(() => trackExternalLinkClick("email", "contact_page"))
            }
            className="imperial-btn imperial-btn-fill group inline-flex items-center"
          >
            <Send className="mr-2.5 h-4 w-4" />
            contact@alpha49.com
          </Link>
        </motion.div>

        <motion.p
          variants={ctaChild}
          className="text-foreground/20 mt-8 text-[10px] tracking-[0.3em] uppercase"
          style={{ fontFamily: "var(--font-geist-mono), monospace" }}
        >
          I usually reply within a day or two
        </motion.p>
      </motion.div>
    </section>
  );
}
