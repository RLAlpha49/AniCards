"use client";

import { motion } from "framer-motion";
import { ArrowUpRight, Mail } from "lucide-react";
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
    tagline: "For detailed inquiries & collaboration",
    address: "contact@alpha49.com",
    accent: "from-amber-500/20 to-yellow-500/10",
  },
  {
    href: "https://discordid.netlify.app/?id=251479989378220044",
    icon: SimpleDiscordIcon,
    name: "discord",
    label: "Discord",
    tagline: "Quick questions & casual chat",
    address: "Alpha49",
    accent: "from-indigo-500/20 to-blue-500/10",
  },
  {
    href: "https://github.com/RLAlpha49",
    icon: SimpleGithubIcon,
    name: "github",
    label: "GitHub",
    tagline: "Projects, code & contributions",
    address: "RLAlpha49",
    accent: "from-slate-500/20 to-zinc-500/10",
  },
  {
    href: "https://anilist.co/user/Alpha49",
    icon: SimpleAniListIcon,
    name: "anilist",
    label: "AniList",
    tagline: "Anime & manga collection",
    address: "Alpha49",
    accent: "from-cyan-500/20 to-blue-500/10",
  },
];

const staggerGrid = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const gridItem = {
  hidden: { opacity: 0, scale: 0.96, y: 20 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
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
        <div className="mb-14 text-center">
          <div className="gold-ornament mb-6">
            <span className="text-gold text-lg">❖</span>
          </div>
          <h2 className="font-display text-foreground mb-3 text-sm tracking-[0.3em] uppercase">
            Ways to Reach Me
          </h2>
          <div className="gold-line mx-auto max-w-12" />
        </div>

        {/* Bento grid */}
        <motion.div
          variants={staggerGrid}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          className="grid gap-4 sm:grid-cols-2"
        >
          {CHANNELS.map((ch) => (
            <motion.div key={ch.name} variants={gridItem}>
              <Link
                href={ch.href}
                target={ch.name === "email" ? undefined : "_blank"}
                rel={ch.name === "email" ? undefined : "noopener noreferrer"}
                onClick={() => handleLinkClick(ch.name)}
                className="imperial-card group relative flex h-full flex-col overflow-hidden p-6 transition-all duration-300 hover:-translate-y-1 sm:p-8"
              >
                {/* Gradient accent stripe at top */}
                <div
                  className={`absolute inset-x-0 top-0 h-1 bg-linear-to-r opacity-0 transition-opacity duration-300 group-hover:opacity-100 ${ch.accent}`}
                />

                <div className="mb-5 flex items-center justify-between">
                  <div className="border-gold/20 group-hover:border-gold/40 border p-3 transition-colors">
                    <ch.icon size={22} className="text-gold" />
                  </div>
                  <ArrowUpRight className="text-gold/20 group-hover:text-gold h-5 w-5 transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </div>

                <h3 className="font-display text-foreground mb-1 text-sm tracking-[0.2em] uppercase">
                  {ch.label}
                </h3>
                <p className="font-body-serif text-foreground/45 mb-4 text-sm leading-relaxed">
                  {ch.tagline}
                </p>

                <div className="mt-auto">
                  <span className="text-gold/70 group-hover:text-gold font-body-serif text-sm transition-colors">
                    {ch.address}
                  </span>
                </div>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
