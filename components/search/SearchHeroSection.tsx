"use client";

import { motion } from "framer-motion";

import { SearchForm } from "./SearchForm";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 28 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const },
  },
};

interface SearchHeroSectionProps {
  onLoadingChange: (loading: boolean) => void;
}

export function SearchHeroSection({
  onLoadingChange,
}: Readonly<SearchHeroSectionProps>) {
  return (
    <section className="relative overflow-hidden px-6 pt-28 pb-24 sm:px-12 md:pt-36 md:pb-32">
      {/* Concentric ring background — sonar/radar motif */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `
            radial-gradient(circle at 50% 42%,
              transparent 8%,
              hsl(var(--gold) / 0.04) 8.3%, transparent 8.6%,
              transparent 16%,
              hsl(var(--gold) / 0.03) 16.3%, transparent 16.6%,
              transparent 24%,
              hsl(var(--gold) / 0.025) 24.3%, transparent 24.6%,
              transparent 32%,
              hsl(var(--gold) / 0.02) 32.3%, transparent 32.6%,
              transparent 40%,
              hsl(var(--gold) / 0.015) 40.3%, transparent 40.6%,
              transparent 48%,
              hsl(var(--gold) / 0.01) 48.3%, transparent 48.6%)
          `,
        }}
      />

      {/* Central gold glow */}
      <div className="pointer-events-none absolute top-1/3 left-1/2 h-125 w-150 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[hsl(var(--gold)/0.06)] blur-[140px]" />

      {/* Floating decorative elements */}
      <motion.div
        className="text-gold/10 pointer-events-none absolute top-24 left-[8%] text-5xl select-none"
        animate={{ y: [0, -15, 0], rotate: [0, 12, 0] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
      >
        ◆
      </motion.div>
      <motion.div
        className="text-gold/8 pointer-events-none absolute right-[10%] bottom-32 text-3xl select-none"
        animate={{ y: [0, 12, 0], rotate: [0, -8, 0] }}
        transition={{
          duration: 7,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 2,
        }}
      >
        ✦
      </motion.div>
      <motion.div
        className="text-gold/6 pointer-events-none absolute top-[50%] left-[5%] hidden text-2xl select-none md:block"
        animate={{ y: [0, -10, 0], opacity: [0.4, 0.8, 0.4] }}
        transition={{
          duration: 6,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1,
        }}
      >
        ◇
      </motion.div>
      <motion.div
        className="text-gold/5 pointer-events-none absolute top-[20%] right-[6%] hidden text-xl select-none lg:block"
        animate={{ y: [0, 8, 0], rotate: [0, -15, 0] }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 3,
        }}
      >
        ◇
      </motion.div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 mx-auto max-w-4xl text-center"
      >
        <motion.p
          variants={itemVariants}
          className="text-gold mb-5 text-xs tracking-[0.6em] uppercase sm:text-sm"
        >
          User Discovery
        </motion.p>

        <motion.h1
          variants={itemVariants}
          className="font-display text-foreground mb-2 text-5xl leading-[1.05] font-black sm:text-6xl md:text-7xl lg:text-8xl"
        >
          DISCOVER
        </motion.h1>

        <motion.h1
          variants={itemVariants}
          className="font-display text-gold mb-6 text-5xl leading-[1.05] font-black sm:text-6xl md:text-7xl lg:text-8xl"
        >
          ANY PROFILE
        </motion.h1>

        <motion.div
          variants={itemVariants}
          className="gold-line-thick mx-auto mb-8 max-w-32"
        />

        <motion.p
          variants={itemVariants}
          className="font-body-serif text-foreground/45 mx-auto mb-6 max-w-lg text-base leading-relaxed sm:text-lg"
        >
          Enter a username or user ID to explore, customize, and export
          beautifully crafted stat cards from any AniList profile.
        </motion.p>

        <motion.div
          variants={itemVariants}
          className="text-foreground/30 mb-14 flex flex-wrap justify-center gap-x-8 gap-y-2 text-xs tracking-[0.2em] uppercase"
        >
          <span>✦ Instant Lookup</span>
          <span>✦ No Login Required</span>
          <span>✦ Auto Setup</span>
        </motion.div>

        <motion.div variants={itemVariants}>
          <SearchForm onLoadingChange={onLoadingChange} />
        </motion.div>
      </motion.div>
    </section>
  );
}
