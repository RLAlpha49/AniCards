"use client";

import { motion } from "framer-motion";

import { ETHOS_ITEMS } from "./constants";

const stagger = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12 },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export function ProjectEthos() {
  return (
    <section className="border-gold/15 relative overflow-hidden border-y-2 bg-[hsl(var(--gold)/0.02)] px-6 py-20 sm:px-12 md:py-24">
      {/* Atmospheric background glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/2 left-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[hsl(var(--gold)/0.04)] blur-[100px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-14 text-center"
        >
          <span className="font-display text-gold text-xs tracking-[0.5em] uppercase">
            Our Principles
          </span>
          <div className="gold-line mx-auto mt-4 max-w-14" />
        </motion.div>

        {/* Horizontal strip with vertical dividers */}
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-40px" }}
          className="grid grid-cols-1 md:grid-cols-3"
        >
          {ETHOS_ITEMS.map((item, index) => (
            <motion.div
              key={item.title}
              variants={fadeUp}
              className={`group p-8 text-center md:p-10 ${
                index < ETHOS_ITEMS.length - 1
                  ? "border-gold/10 border-b md:border-r md:border-b-0"
                  : ""
              }`}
            >
              <div className="border-gold/20 group-hover:border-gold/40 mx-auto mb-6 inline-flex border p-4 transition-colors duration-300">
                <item.icon size={22} className="text-gold" />
              </div>
              <span className="font-display text-gold/20 mb-4 block text-2xl">
                {item.numeral}
              </span>
              <h3 className="font-display text-foreground mb-3 text-sm tracking-[0.25em]">
                {item.title}
              </h3>

              <div className="gold-line mx-auto mb-4 max-w-8" />

              <p className="font-body-serif text-foreground/45 text-sm leading-relaxed">
                {item.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
