"use client";

import { motion } from "framer-motion";
import { Clock, Globe, MessageCircle, Send } from "lucide-react";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.15 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 28 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
  },
};

const HIGHLIGHTS = [
  { icon: MessageCircle, label: "4 Channels" },
  { icon: Clock, label: "< 48h Reply" },
  { icon: Globe, label: "Open Source" },
];

export function ContactHeroSection() {
  return (
    <section className="relative overflow-hidden px-6 pt-24 pb-16 sm:px-12 md:pt-32 md:pb-20">
      {/* Decorative glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/3 left-1/2 h-120 w-120 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[hsl(var(--gold)/0.06)] blur-[120px]" />
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 mx-auto max-w-5xl"
      >
        <div className="grid items-end gap-12 md:grid-cols-[1.2fr_auto]">
          {/* Text column */}
          <div>
            <motion.p
              variants={itemVariants}
              className="text-gold mb-4 text-xs tracking-[0.5em] uppercase sm:text-sm"
            >
              Correspondence
            </motion.p>

            <motion.h1
              variants={itemVariants}
              className="font-display text-foreground mb-5 text-5xl leading-[1.05] font-black sm:text-6xl md:text-7xl lg:text-8xl"
            >
              LET&apos;S
              <br />
              <span className="text-gold">CONNECT</span>
            </motion.h1>

            <motion.div
              variants={itemVariants}
              className="gold-line-thick mb-6 max-w-32"
            />

            <motion.p
              variants={itemVariants}
              className="font-body-serif text-foreground/55 max-w-lg text-base leading-relaxed sm:text-lg"
            >
              Have a question, idea, or collaboration in mind? Pick the channel
              that suits you best and let&apos;s start a conversation.
            </motion.p>
          </div>

          {/* Decorative icon frame */}
          <motion.div
            variants={itemVariants}
            className="hidden md:block"
            aria-hidden="true"
          >
            <div className="border-gold/15 relative border-2 p-6">
              <div className="border-gold/10 border-2 p-5">
                <Send className="text-gold/30 h-20 w-20" strokeWidth={1} />
              </div>
              <div className="border-gold absolute -top-1.5 -left-1.5 h-3 w-3 border-t-2 border-l-2" />
              <div className="border-gold absolute -right-1.5 -bottom-1.5 h-3 w-3 border-r-2 border-b-2" />
            </div>
          </motion.div>
        </div>

        {/* Highlight chips */}
        <motion.div
          variants={itemVariants}
          className="mt-14 flex flex-wrap items-center gap-5"
        >
          {HIGHLIGHTS.map((h) => (
            <div
              key={h.label}
              className="border-gold/15 bg-gold/3 flex items-center gap-2.5 border px-4 py-2.5"
            >
              <h.icon className="text-gold h-4 w-4" strokeWidth={1.5} />
              <span className="text-foreground/50 text-xs tracking-wider uppercase">
                {h.label}
              </span>
            </div>
          ))}
        </motion.div>
      </motion.div>
    </section>
  );
}
