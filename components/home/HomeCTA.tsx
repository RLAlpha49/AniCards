"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

import { safeTrack, trackButtonClick } from "@/lib/utils/google-analytics";

export function HomeCTA() {
  const router = useRouter();

  const handleClick = useCallback(() => {
    safeTrack(() => trackButtonClick("cta_create_cards", "homepage_cta"));
    router.push("/search");
  }, [router]);

  return (
    <section className="border-gold/20 relative border-y-2 px-6 py-20 text-center sm:px-12 md:py-28">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[hsl(var(--gold)/0.04)] blur-[100px]" />
      </div>

      <div className="relative z-10">
        <div className="gold-ornament mb-8">
          <span className="text-gold text-xl">❖</span>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
        >
          <h2 className="font-display text-gold mb-5 text-3xl sm:text-4xl lg:text-5xl">
            READY TO BUILD YOURS?
          </h2>

          <p className="font-body-serif text-foreground/40 mx-auto mb-10 max-w-md text-base sm:text-lg">
            Numbers that look good enough to frame. Your stats deserve better
            than a spreadsheet.
          </p>

          <motion.button
            onClick={handleClick}
            className="imperial-btn imperial-btn-fill"
            whileHover={{
              scale: 1.04,
              boxShadow: "0 0 40px hsl(42 63% 55% / 0.4)",
            }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
          >
            ❖ Build Your Cards ❖
          </motion.button>
        </motion.div>
      </div>
    </section>
  );
}
