"use client";

import { motion } from "framer-motion";
import { ArrowUpRight, Mail } from "lucide-react";
import Link from "next/link";

import {
  SimpleAniListIcon,
  SimpleDiscordIcon,
  SimpleGithubIcon,
} from "@/components/SimpleIcons";
import { EASE_OUT_EXPO } from "@/lib/animations";
import {
  safeTrack,
  trackExternalLinkClick,
} from "@/lib/utils/google-analytics";

const CHANNELS = [
  {
    href: "mailto:contact@alpha49.com",
    icon: Mail,
    name: "email",
    label: "Email",
    tagline: "For detailed inquiries & collaboration",
    address: "contact@alpha49.com",
    numeral: "01",
  },
  {
    href: "https://discordid.netlify.app/?id=251479989378220044",
    icon: SimpleDiscordIcon,
    name: "discord",
    label: "Discord",
    tagline: "Low-key questions & casual back-and-forth",
    address: "Alpha49",
    numeral: "02",
  },
  {
    href: "https://github.com/RLAlpha49",
    icon: SimpleGithubIcon,
    name: "github",
    label: "GitHub",
    tagline: "Where the code actually lives",
    address: "RLAlpha49",
    numeral: "03",
  },
  {
    href: "https://anilist.co/user/Alpha49",
    icon: SimpleAniListIcon,
    name: "anilist",
    label: "AniList",
    tagline: "Lists, stats & the anime deep-cuts",
    address: "Alpha49",
    numeral: "04",
  },
];

const stagger = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.15 },
  },
};

const panelVariant = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export function ContactChannels() {
  const handleClick = (platform: string) => {
    safeTrack(() => trackExternalLinkClick(platform, "contact_page"));
  };

  return (
    <section className="px-6 py-20 sm:px-12 md:py-28">
      <div className="mx-auto max-w-6xl">
        {/* Section heading */}
        <div className="mb-16">
          <div className="mb-4 flex items-center gap-4">
            <div className="h-px w-16 max-w-16 bg-[hsl(var(--gold)/0.3)]" />
            <span className="font-display text-gold text-[0.65rem] tracking-[0.5em] uppercase">
              Channels
            </span>
          </div>
          <h2 className="font-display text-foreground text-3xl tracking-tight sm:text-4xl md:text-5xl">
            WAYS TO
            <br />
            <span className="text-gold">CONNECT</span>
          </h2>
        </div>

        {/* Channel panels — separated by 1px gold gap lines */}
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="grid grid-cols-1 gap-px bg-[hsl(var(--gold)/0.1)] sm:grid-cols-2 lg:grid-cols-4"
        >
          {CHANNELS.map((ch) => (
            <motion.div
              key={ch.name}
              variants={panelVariant}
              whileHover={{
                y: -4,
                transition: { duration: 0.3, ease: EASE_OUT_EXPO },
              }}
            >
              <Link
                href={ch.href}
                target={ch.name === "email" ? undefined : "_blank"}
                rel={ch.name === "email" ? undefined : "noopener noreferrer"}
                onClick={() => handleClick(ch.name)}
                className="bg-background group relative flex h-full flex-col p-8 transition-all duration-500 hover:bg-[hsl(var(--gold)/0.03)] sm:p-10"
              >
                {/* Large background numeral */}
                <span
                  className="font-display pointer-events-none absolute top-4 right-4 text-[5rem] leading-none text-[hsl(var(--foreground)/0.03)] transition-colors duration-500 group-hover:text-[hsl(var(--gold)/0.08)]"
                  aria-hidden="true"
                >
                  {ch.numeral}
                </span>

                {/* Icon */}
                <div className="relative mb-8">
                  <div className="inline-flex border-2 border-[hsl(var(--gold)/0.15)] p-3.5 transition-all duration-500 group-hover:border-[hsl(var(--gold)/0.4)] group-hover:shadow-[0_0_20px_hsl(var(--gold)/0.08)]">
                    <ch.icon
                      size={20}
                      className="text-gold transition-transform duration-500 group-hover:scale-110"
                    />
                  </div>
                </div>

                {/* Label */}
                <h3 className="font-display text-foreground mb-2 text-sm tracking-[0.25em] uppercase">
                  {ch.label}
                </h3>

                {/* Description */}
                <p className="font-body-serif text-foreground/40 mb-8 text-sm leading-relaxed">
                  {ch.tagline}
                </p>

                {/* Bottom: Address + arrow */}
                <div className="mt-auto flex items-center justify-between">
                  <span className="font-body-serif text-gold/60 group-hover:text-gold text-sm transition-colors duration-300">
                    {ch.address}
                  </span>
                  <ArrowUpRight className="text-gold h-4 w-4 opacity-0 transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100" />
                </div>

                {/* Bottom accent line that extends on hover */}
                <div className="via-gold absolute bottom-0 left-1/2 h-0.5 w-0 -translate-x-1/2 bg-linear-to-r from-transparent to-transparent transition-all duration-500 group-hover:w-4/5" />
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
