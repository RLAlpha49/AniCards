"use client";

import { motion } from "framer-motion";
import { Layers, Palette, Share2 } from "lucide-react";

import { EASE_OUT_EXPO, fadeIn, fadeUp } from "@/lib/animations";

const CAPABILITIES = [
  {
    icon: Layers,
    title: "VARIED CARD TYPES",
    desc: "Activity stats, genre breakdowns, favorites, social metrics \u2014 nearly every angle of your profile gets its own dedicated card.",
  },
  {
    icon: Palette,
    title: "DEEP CUSTOMIZATION",
    desc: "Pick from handpicked color palettes or build one from scratch. Dark, vivid, understated \u2014 whatever suits your taste.",
  },
  {
    icon: Share2,
    title: "SHARE EVERYWHERE",
    desc: "SVG and PNG exports that look crisp on GitHub readmes, social profiles, forums \u2014 basically anywhere you want to show them off.",
  },
];

export function SearchCapabilities() {
  return (
    <section className="px-6 py-20 sm:px-12 md:py-28">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6 }}
        className="mb-16 text-center"
      >
        <p className="mb-4 text-xs tracking-[0.5em] text-gold uppercase sm:text-sm">
          What's Inside
        </p>
        <h2 className="mb-4 font-display text-3xl tracking-[0.15em] text-foreground sm:text-4xl">
          ASSEMBLE YOUR SET
        </h2>
        <div className="gold-line-thick mx-auto max-w-20" />
      </motion.div>

      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 md:grid-cols-3 md:gap-6">
        {CAPABILITIES.map((cap, i) => (
          <motion.div
            key={cap.title}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={{
              hidden: { opacity: 0, y: 40, scale: 0.96 },
              visible: {
                opacity: 1,
                y: 0,
                scale: 1,
                transition: {
                  duration: 0.6,
                  delay: i * 0.12,
                  ease: EASE_OUT_EXPO,
                  staggerChildren: 0.08,
                  delayChildren: 0.25,
                },
              },
            }}
            whileHover={{ y: -6, transition: { duration: 0.25 } }}
            className={`
              group relative border-2 border-gold/10 bg-gold/2 p-8 text-center transition-colors
              duration-500
              hover:border-gold/30${i === 1 ? `md:-translate-y-4` : ""}
            `}
          >
            {/* Top accent line that slides in */}
            <div className="absolute inset-x-0 top-0 h-0.5 overflow-hidden">
              <motion.div
                className="h-full bg-linear-to-r from-transparent via-gold to-transparent"
                initial={{ x: "-100%" }}
                whileInView={{ x: "0%" }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: 0.3 + i * 0.1 }}
              />
            </div>

            {/* Icon container */}
            <motion.div
              variants={fadeIn}
              whileHover={{ scale: 1.1, transition: { duration: 0.25 } }}
              className="
                mx-auto mb-6 flex size-16 items-center justify-center border border-gold/20
                bg-gold/5 transition-all duration-300
                group-hover:border-gold/40 group-hover:bg-gold/8
              "
            >
              <cap.icon className="size-7 text-gold/70 transition-colors group-hover:text-gold" />
            </motion.div>

            <motion.h3
              variants={fadeUp}
              className="mb-4 font-display text-sm tracking-[0.25em] text-foreground"
            >
              {cap.title}
            </motion.h3>
            <div className="gold-line mx-auto mb-4 max-w-10" />
            <motion.p
              variants={fadeUp}
              className="font-body-serif text-sm/relaxed text-foreground/45"
            >
              {cap.desc}
            </motion.p>

            {/* Hover glow */}
            <div className="
              pointer-events-none absolute inset-0
              bg-[radial-gradient(ellipse_at_center,hsl(var(--gold)/0.04),transparent_70%)]
              opacity-0 transition-opacity duration-500
              group-hover:opacity-100
            " />
          </motion.div>
        ))}
      </div>
    </section>
  );
}
