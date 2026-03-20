"use client";

import { motion } from "framer-motion";
import { ArrowRight, Mail } from "lucide-react";
import Link from "next/link";

import {
  SimpleAniListIcon,
  SimpleDiscordIcon,
  SimpleGithubIcon,
} from "@/components/SimpleIcons";
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
    tagline: "Detailed inquiries & collaboration",
    address: "contact@alpha49.com",
    num: "01",
  },
  {
    href: "https://discordid.netlify.app/?id=251479989378220044",
    icon: SimpleDiscordIcon,
    name: "discord",
    label: "Discord",
    tagline: "Quick questions & casual chat",
    address: "Alpha49",
    num: "02",
  },
  {
    href: "https://github.com/RLAlpha49",
    icon: SimpleGithubIcon,
    name: "github",
    label: "GitHub",
    tagline: "Projects, code & contributions",
    address: "RLAlpha49",
    num: "03",
  },
  {
    href: "https://anilist.co/user/Alpha49",
    icon: SimpleAniListIcon,
    name: "anilist",
    label: "AniList",
    tagline: "Anime & manga collection",
    address: "Alpha49",
    num: "04",
  },
];

const stagger = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.1 },
  },
};

const row = {
  hidden: { opacity: 0, x: -32 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export function ContactChannels() {
  const handleLinkClick = (platform: string) => {
    safeTrack(() => trackExternalLinkClick(platform, "contact_page"));
  };

  return (
    <section className="px-6 py-16 sm:px-12 md:py-24">
      <div className="mx-auto max-w-5xl">
        {/* Section heading */}
        <div className="mb-12">
          <span
            className="text-[10px] tracking-[0.5em] uppercase"
            style={{
              fontFamily: "var(--font-geist-mono), monospace",
              color: "hsl(var(--gold) / 0.4)",
            }}
          >
            Frequencies
          </span>
          <h2 className="font-display text-foreground mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
            SELECT CHANNEL
          </h2>
        </div>

        {/* Channel rows */}
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          className="border-t border-[hsl(var(--gold)/0.1)]"
        >
          {CHANNELS.map((ch) => (
            <motion.div key={ch.name} variants={row}>
              <Link
                href={ch.href}
                target={ch.name === "email" ? undefined : "_blank"}
                rel={ch.name === "email" ? undefined : "noopener noreferrer"}
                onClick={() => handleLinkClick(ch.name)}
                className="group flex items-center gap-4 border-b border-[hsl(var(--gold)/0.1)] py-6 transition-all duration-300 hover:pl-3 sm:gap-6 sm:py-8"
              >
                {/* Number */}
                <span
                  className="hidden min-w-10 text-right text-sm transition-colors sm:block"
                  style={{
                    fontFamily: "var(--font-geist-mono), monospace",
                    color: "hsl(var(--gold) / 0.2)",
                  }}
                >
                  <span className="group-hover:text-gold/50 transition-colors">
                    {ch.num}
                  </span>
                </span>

                {/* Icon badge */}
                <div className="flex h-12 w-12 shrink-0 items-center justify-center border border-[hsl(var(--gold)/0.15)] transition-all duration-300 group-hover:border-[hsl(var(--gold)/0.4)] group-hover:bg-[hsl(var(--gold)/0.05)]">
                  <ch.icon
                    size={20}
                    className="text-gold/60 group-hover:text-gold transition-colors"
                  />
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <h3 className="font-display text-foreground group-hover:text-gold text-sm tracking-[0.15em] uppercase transition-colors">
                    {ch.label}
                  </h3>
                  <p className="font-body-serif text-foreground/35 mt-0.5 text-sm">
                    {ch.tagline}
                  </p>
                </div>

                {/* Address */}
                <span
                  className="hidden text-xs transition-colors sm:block"
                  style={{
                    fontFamily: "var(--font-geist-mono), monospace",
                    color: "hsl(var(--foreground) / 0.2)",
                  }}
                >
                  <span className="group-hover:text-gold/60 transition-colors">
                    {ch.address}
                  </span>
                </span>

                {/* Arrow */}
                <ArrowRight className="text-gold/15 group-hover:text-gold h-5 w-5 shrink-0 transition-all duration-300 group-hover:translate-x-1" />
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
