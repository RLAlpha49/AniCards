"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Mail } from "lucide-react";
import Link from "next/link";

import {
  SimpleAniListIcon,
  SimpleDiscordIcon,
  SimpleGithubIcon,
} from "@/components/SimpleIcons";
import {
  buildFadeUpVariants,
  buildMotionSafeStaggerContainer,
  EASE_OUT_EXPO,
  getMotionSafeAnimation,
} from "@/lib/animations";
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

export function ContactChannels() {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const stagger = buildMotionSafeStaggerContainer({
    reducedMotion: prefersReducedMotion,
    staggerChildren: 0.1,
    delayChildren: 0.15,
  });
  const panelVariant = buildFadeUpVariants({
    reducedMotion: prefersReducedMotion,
    distance: 40,
    duration: 0.6,
  });

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
            <span className="font-display text-[0.65rem] tracking-[0.5em] text-gold uppercase">
              Channels
            </span>
          </div>
          <h2 className="
            font-display text-3xl tracking-tight text-foreground
            sm:text-4xl
            md:text-5xl
          ">
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
          className="
            grid grid-cols-1 gap-px bg-[hsl(var(--gold)/0.1)]
            sm:grid-cols-2
            lg:grid-cols-4
          "
        >
          {CHANNELS.map((ch) => (
            <motion.div
              key={ch.name}
              variants={panelVariant}
              whileHover={getMotionSafeAnimation(prefersReducedMotion, {
                y: -4,
                transition: { duration: 0.3, ease: EASE_OUT_EXPO },
              })}
            >
              <Link
                href={ch.href}
                target={ch.name === "email" ? undefined : "_blank"}
                rel={ch.name === "email" ? undefined : "noopener noreferrer"}
                onClick={() => handleClick(ch.name)}
                className="
                  group relative flex h-full flex-col rounded-sm bg-background p-8 transition-all
                  duration-500
                  hover:bg-[hsl(var(--gold)/0.03)]
                  focus-visible:bg-[hsl(var(--gold)/0.03)] focus-visible:ring-2
                  focus-visible:ring-gold/50 focus-visible:ring-offset-2
                  focus-visible:ring-offset-background focus-visible:outline-none
                  sm:p-10
                "
              >
                {/* Large background numeral */}
                <span
                  className="
                    pointer-events-none absolute top-4 right-4 font-display text-[5rem] leading-none
                    text-[hsl(var(--foreground)/0.03)] transition-colors duration-500
                    group-hover:text-[hsl(var(--gold)/0.08)]
                    group-focus-visible:text-[hsl(var(--gold)/0.08)]
                  "
                  aria-hidden="true"
                >
                  {ch.numeral}
                </span>

                {/* Icon */}
                <div className="relative mb-8">
                  <div className="
                    inline-flex border-2 border-[hsl(var(--gold)/0.15)] p-3.5 transition-all
                    duration-500
                    group-hover:border-[hsl(var(--gold)/0.4)]
                    group-hover:shadow-[0_0_20px_hsl(var(--gold)/0.08)]
                    group-focus-visible:border-[hsl(var(--gold)/0.4)]
                    group-focus-visible:shadow-[0_0_20px_hsl(var(--gold)/0.08)]
                  ">
                    <ch.icon
                      size={20}
                      className="
                        text-gold transition-transform duration-500
                        group-hover:scale-110
                        group-focus-visible:scale-110
                      "
                    />
                  </div>
                </div>

                {/* Label */}
                <h3 className="
                  mb-2 font-display text-sm tracking-[0.25em] text-foreground uppercase
                ">
                  {ch.label}
                </h3>

                {/* Description */}
                <p className="mb-8 font-body-serif text-sm/relaxed text-foreground/40">
                  {ch.tagline}
                </p>

                {/* Bottom: Address + arrow */}
                <div className="mt-auto flex items-center justify-between">
                  <span className="
                    font-body-serif text-sm text-gold/60 transition-colors duration-300
                    group-hover:text-gold
                    group-focus-visible:text-gold
                  ">
                    {ch.address}
                  </span>
                  <ArrowUpRight className="
                    size-4 text-gold opacity-0 transition-all duration-300
                    group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100
                    group-focus-visible:translate-x-0.5 group-focus-visible:-translate-y-0.5
                    group-focus-visible:opacity-100
                  " />
                </div>

                {/* Bottom accent line that extends on hover */}
                <div className="
                  absolute bottom-0 left-1/2 h-0.5 w-0 -translate-x-1/2 bg-linear-to-r
                  from-transparent via-gold to-transparent transition-all duration-500
                  group-hover:w-4/5
                  group-focus-visible:w-4/5
                " />
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
