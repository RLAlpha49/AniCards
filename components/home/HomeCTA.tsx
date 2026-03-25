"use client";

import { motion } from "framer-motion";
import Link from "next/link";

import { safeTrack, trackButtonClick } from "@/lib/utils/google-analytics";

export function HomeCTA() {
  const handleClick = () => {
    safeTrack(() => trackButtonClick("cta_create_cards", "homepage_cta"));
  };

  return (
    <section className="relative border-y-2 border-gold/20 px-6 py-20 text-center sm:px-12 md:py-28">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="
          absolute top-1/2 left-1/2 size-96 -translate-1/2 rounded-full bg-[hsl(var(--gold)/0.04)]
          blur-[100px]
        " />
      </div>

      <div className="relative z-10">
        <div className="mb-8 gold-ornament">
          <span className="text-xl text-gold">❖</span>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
        >
          <h2 className="mb-5 font-display text-3xl text-gold sm:text-4xl lg:text-5xl">
            READY TO BUILD YOURS?
          </h2>

          <p className="
            mx-auto mb-10 max-w-md font-body-serif text-base text-foreground/40
            sm:text-lg
          ">
            Numbers that look good enough to frame. Your stats deserve better
            than a spreadsheet.
          </p>

          <motion.div
            className="inline-block"
            whileHover={{
              scale: 1.04,
              boxShadow: "0 0 40px hsl(42 63% 55% / 0.4)",
            }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
          >
            <Link
              href="/search"
              onClick={handleClick}
              className="imperial-btn imperial-btn-fill"
            >
              ❖ Build Your Cards ❖
            </Link>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
