"use client";

import { motion } from "framer-motion";
import { ArrowRight, GitFork } from "lucide-react";
import Link from "next/link";

import { SimpleGithubIcon } from "@/components/SimpleIcons";
import { Button } from "@/components/ui/Button";
import { EASE_OUT_EXPO } from "@/lib/animations";

const fadeIn = {
  hidden: { opacity: 0, y: 28 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.75, ease: [0.22, 1, 0.36, 1] as const },
  },
};

const lineExpand = {
  hidden: { scaleX: 0 },
  visible: {
    scaleX: 1,
    transition: { duration: 1, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export function ProjectsCTA() {
  return (
    <section className="relative overflow-hidden px-6 py-28 sm:px-12 md:py-36">
      {/* Radial spotlight glow */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 50%, hsl(var(--gold) / 0.07), transparent)",
        }}
      />

      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-60px" }}
        transition={{ staggerChildren: 0.12 }}
        className="relative z-10 mx-auto max-w-3xl text-center"
      >
        {/* Top ornamental line */}
        <motion.div
          variants={lineExpand}
          className="mx-auto mb-12 h-px max-w-20 origin-center"
          style={{
            background:
              "linear-gradient(90deg, transparent, hsl(var(--gold) / 0.6), transparent)",
          }}
        />

        <motion.p
          variants={fadeIn}
          className="text-gold/50 mb-5 font-mono text-[0.6rem] tracking-[0.5em] uppercase"
        >
          ◆ Contribute
        </motion.p>

        <motion.h2
          variants={fadeIn}
          className="font-display text-foreground mb-4 text-4xl leading-[0.9] sm:text-5xl md:text-6xl"
        >
          BUILD WITH
          <br />
          <span className="text-gold">US</span>
        </motion.h2>

        <motion.div
          variants={lineExpand}
          className="mx-auto mb-8 h-0.5 max-w-10 origin-center"
          style={{
            background:
              "linear-gradient(90deg, transparent, hsl(var(--gold)), transparent)",
          }}
        />

        <motion.p
          variants={fadeIn}
          className="font-body-serif text-foreground/40 mx-auto mb-12 max-w-md text-sm leading-[1.85] sm:text-base"
        >
          Every star, issue, and pull request pushes these tools forward. Jump
          in — contributions of any size are genuinely welcome.
        </motion.p>

        <motion.div
          variants={fadeIn}
          className="flex flex-col items-center justify-center gap-4 sm:flex-row"
        >
          <motion.div
            variants={fadeIn}
            whileHover={{
              scale: 1.04,
              transition: { duration: 0.25, ease: EASE_OUT_EXPO },
            }}
            whileTap={{ scale: 0.97 }}
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
          </motion.div>

          <motion.div
            variants={fadeIn}
            whileHover={{
              scale: 1.04,
              transition: { duration: 0.25, ease: EASE_OUT_EXPO },
            }}
            whileTap={{ scale: 0.97 }}
          >
            <Button asChild className="imperial-btn imperial-btn-ghost">
              <Link href="/" className="flex items-center gap-2">
                <GitFork className="h-4 w-4" />
                Back to Home
              </Link>
            </Button>
          </motion.div>
        </motion.div>

        {/* Bottom ornamental line */}
        <motion.div
          variants={lineExpand}
          className="mx-auto mt-12 h-px max-w-20 origin-center"
          style={{
            background:
              "linear-gradient(90deg, transparent, hsl(var(--gold) / 0.4), transparent)",
          }}
        />
      </motion.div>
    </section>
  );
}
