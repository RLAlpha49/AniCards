"use client";

import { motion } from "framer-motion";

import { ETHOS_ITEMS } from "./constants";

const stagger = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.1 },
  },
};

const cardReveal = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] as const },
  },
};

const lineGrow = {
  hidden: { scaleX: 0 },
  visible: {
    scaleX: 1,
    transition: { duration: 1.2, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export function ProjectEthos() {
  return (
    <section className="relative px-6 py-20 sm:px-12 md:py-28">
      <div className="relative mx-auto max-w-7xl">
        {/* Section label */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.5 }}
          className="mb-14 flex items-center gap-4 font-mono text-[0.6rem] tracking-[0.4em] uppercase sm:text-xs"
        >
          <span className="text-gold/60">03</span>
          <span
            className="inline-block h-px max-w-16 flex-1"
            style={{
              background:
                "linear-gradient(90deg, hsl(var(--gold) / 0.3), transparent)",
            }}
          />
          <span className="text-foreground/30">Principles</span>
        </motion.div>

        {/* Connecting gold timeline line */}
        <motion.div
          variants={lineGrow}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-40px" }}
          className="mb-12 hidden h-px origin-left md:block"
          style={{
            background:
              "linear-gradient(90deg, hsl(var(--gold) / 0.5), hsl(var(--gold) / 0.15) 50%, hsl(var(--gold) / 0.5))",
          }}
        />

        {/* Principles grid */}
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-40px" }}
          className="grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-8 lg:gap-12"
        >
          {ETHOS_ITEMS.map((item, i) => (
            <motion.div
              key={item.title}
              variants={cardReveal}
              className="group relative"
            >
              {/* Node dot on the timeline */}
              <div
                className="bg-background border-gold/40 absolute -top-[3.35rem] left-1/2 hidden h-3 w-3 -translate-x-1/2 border md:block"
                aria-hidden="true"
                style={{
                  transform: "translateX(-50%) rotate(45deg)",
                }}
              />

              <div className="relative text-center md:text-left">
                {/* Icon container */}
                <div className="border-gold/20 group-hover:border-gold/40 group-hover:bg-gold/5 mx-auto mb-6 inline-flex border p-3.5 transition-all duration-300 md:mx-0">
                  <item.icon
                    size={22}
                    className="text-gold/70 group-hover:text-gold transition-colors duration-300"
                  />
                </div>

                {/* Number + Title */}
                <div className="mb-4 flex items-center justify-center gap-3 md:justify-start">
                  <span className="text-gold/30 font-mono text-xs tracking-[0.3em]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div
                    className="h-px w-4"
                    style={{
                      background:
                        "linear-gradient(90deg, hsl(var(--gold) / 0.3), transparent)",
                    }}
                  />
                </div>

                <h3 className="font-display text-foreground group-hover:text-gold/90 mb-4 text-sm tracking-[0.2em] transition-colors duration-300">
                  {item.title}
                </h3>

                <p className="font-body-serif text-foreground/40 mx-auto max-w-xs text-sm leading-[1.75] md:mx-0">
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
