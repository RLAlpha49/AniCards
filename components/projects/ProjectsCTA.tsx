"use client";

import { motion } from "framer-motion";
import { ArrowRight, GitFork } from "lucide-react";
import Link from "next/link";

import { SimpleGithubIcon } from "@/components/SimpleIcons";
import { Button } from "@/components/ui/Button";

const fadeIn = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export function ProjectsCTA() {
  return (
    <section className="relative overflow-hidden px-6 py-24 sm:px-12 md:py-32">
      {/* Oversized background text */}
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center select-none"
        aria-hidden="true"
      >
        <span className="font-display text-gold/3 text-[10rem] leading-none sm:text-[16rem] md:text-[22rem]">
          ✦
        </span>
      </div>

      {/* Subtle radial glow */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(ellipse at 50% 50%, hsl(var(--gold) / 0.06), transparent 55%)",
        }}
      />

      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-60px" }}
        transition={{ staggerChildren: 0.1 }}
        className="relative z-10 mx-auto max-w-2xl text-center"
      >
        {/* Top ornamental line */}
        <motion.div
          variants={fadeIn}
          className="mx-auto mb-10 h-px max-w-24"
          style={{
            background:
              "linear-gradient(90deg, transparent, hsl(var(--gold) / 0.5), transparent)",
          }}
        />

        <motion.p
          variants={fadeIn}
          className="text-gold/50 mb-4 font-mono text-[0.6rem] tracking-[0.5em] uppercase"
        >
          § Get Involved
        </motion.p>

        <motion.h2
          variants={fadeIn}
          className="font-display text-foreground mb-6 text-3xl sm:text-4xl md:text-5xl"
        >
          GET
          <br />
          <span className="text-gold">INVOLVED</span>
        </motion.h2>

        <motion.div
          variants={fadeIn}
          className="mx-auto mb-6 h-px max-w-12"
          style={{
            background:
              "linear-gradient(90deg, transparent, hsl(var(--gold) / 0.4), transparent)",
          }}
        />

        <motion.p
          variants={fadeIn}
          className="font-body-serif text-foreground/40 mx-auto mb-10 max-w-md text-sm leading-[1.8] sm:text-base"
        >
          Stars and issues aren't just vanity metrics here — every contribution,
          however small, pushes these tools forward for everyone.
        </motion.p>

        <motion.div
          variants={fadeIn}
          className="flex flex-col items-center justify-center gap-4 sm:flex-row"
        >
          <Button asChild className="imperial-btn imperial-btn-fill">
            <a
              href="https://github.com/RLAlpha49"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2"
            >
              <SimpleGithubIcon size={20} />
              Visit My GitHub
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </a>
          </Button>

          <Button asChild className="imperial-btn imperial-btn-ghost">
            <Link href="/" className="flex items-center gap-2">
              <GitFork className="h-4 w-4" />
              Back to Home
            </Link>
          </Button>
        </motion.div>
      </motion.div>
    </section>
  );
}
