"use client";

import { motion } from "framer-motion";

import { ETHOS_ITEMS } from "./constants";

const stagger = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.08 },
  },
};

const cardReveal = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export function ProjectEthos() {
  return (
    <section className="relative px-6 py-20 sm:px-12 md:py-28">
      {/* Background accent */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40 dark:opacity-25"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(ellipse at 30% 50%, hsl(var(--gold) / 0.04), transparent 60%)",
        }}
      />

      <div className="relative mx-auto max-w-6xl">
        {/* Section label */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.5 }}
          className="mb-14 flex items-center gap-4 font-mono text-[0.6rem] tracking-[0.4em] uppercase sm:text-xs"
        >
          <span className="text-gold/50">§ 03</span>
          <span className="bg-gold/20 inline-block h-px max-w-20 flex-1" />
          <span className="text-foreground/30">What Drives This</span>
        </motion.div>

        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-40px" }}
          className="grid grid-cols-1 gap-px overflow-hidden md:grid-cols-3"
          style={{
            background:
              "linear-gradient(180deg, hsl(var(--gold) / 0.12), hsl(var(--gold) / 0.06))",
          }}
        >
          {ETHOS_ITEMS.map((item, i) => (
            <motion.div
              key={item.title}
              variants={cardReveal}
              className="bg-background relative p-8 sm:p-10"
            >
              {/* Large watermark number */}
              <span
                className="font-display text-gold/5 pointer-events-none absolute -top-2 right-4 text-[7rem] leading-none select-none"
                aria-hidden="true"
              >
                {String(i + 1).padStart(2, "0")}
              </span>

              <div className="relative z-10">
                <div className="border-gold/20 mb-6 inline-flex border p-3">
                  <item.icon size={20} className="text-gold" />
                </div>

                <h3 className="font-display text-foreground mb-3 text-sm tracking-[0.2em]">
                  {item.title}
                </h3>

                <div
                  className="mb-4 h-px max-w-10"
                  style={{
                    background:
                      "linear-gradient(90deg, hsl(var(--gold) / 0.4), transparent)",
                  }}
                />

                <p className="font-body-serif text-foreground/45 text-sm leading-[1.7]">
                  {item.description}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
