"use client";

import { motion } from "framer-motion";

import { ETHOS_ITEMS } from "./constants";

const staggerGrid = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 },
  },
};

const gridItem = {
  hidden: { opacity: 0, scale: 0.95, y: 16 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export function ProjectEthos() {
  return (
    <section className="px-6 py-16 sm:px-12 md:py-20">
      <div className="mx-auto max-w-4xl">
        <motion.div
          variants={staggerGrid}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-40px" }}
          className="grid grid-cols-1 gap-5 md:grid-cols-3"
        >
          {ETHOS_ITEMS.map((item) => (
            <motion.div
              key={item.title}
              variants={gridItem}
              className="imperial-card text-center"
            >
              <div className="border-gold/20 mx-auto mb-5 inline-flex border p-3">
                <item.icon size={20} className="text-gold" />
              </div>
              <span className="font-display text-gold/30 mb-3 block text-3xl">
                {item.numeral}
              </span>
              <h3 className="font-display text-foreground mb-3 text-sm tracking-[0.25em]">
                {item.title}
              </h3>
              <div className="gold-line mx-auto mb-3 max-w-10" />
              <p className="font-body-serif text-foreground/50 text-sm leading-relaxed">
                {item.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
