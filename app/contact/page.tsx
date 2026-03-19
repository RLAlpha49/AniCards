"use client";

// Curated contact page for the public site. The content arrays below act like a
// tiny content model so the order, copy, and supported contact channels can be
// edited without reshaping the layout.

import { motion } from "framer-motion";
import {
  ArrowUpRight,
  Bug,
  ExternalLink,
  Lightbulb,
  Mail,
  MessageSquare,
  Send,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

import {
  SimpleAniListIcon,
  SimpleDiscordIcon,
  SimpleGithubIcon,
} from "@/components/SimpleIcons";
import { usePageSEO } from "@/hooks/usePageSEO";
import {
  safeTrack,
  trackExternalLinkClick,
} from "@/lib/utils/google-analytics";

// Keep these as data instead of inline JSX so the page stays easy to reorder or
// expand when contact options change.
const CHANNELS = [
  {
    href: "mailto:contact@alpha49.com",
    icon: Mail,
    name: "email",
    label: "Email",
    numeral: "Ⅰ",
    tagline: "For detailed inquiries & collaboration",
    address: "contact@alpha49.com",
  },
  {
    href: "https://discordid.netlify.app/?id=251479989378220044",
    icon: SimpleDiscordIcon,
    name: "discord",
    label: "Discord",
    numeral: "Ⅱ",
    tagline: "Quick questions & casual chat",
    address: "Alpha49",
  },
  {
    href: "https://github.com/RLAlpha49",
    icon: SimpleGithubIcon,
    name: "github",
    label: "GitHub",
    numeral: "Ⅲ",
    tagline: "Projects, code & contributions",
    address: "RLAlpha49",
  },
  {
    href: "https://anilist.co/user/Alpha49",
    icon: SimpleAniListIcon,
    name: "anilist",
    label: "AniList",
    numeral: "Ⅳ",
    tagline: "Anime & manga collection",
    address: "Alpha49",
  },
];

const REASONS = [
  {
    icon: MessageSquare,
    title: "General Questions",
    description: "Anything about AniCards, usage, or features",
  },
  {
    icon: Lightbulb,
    title: "Feature Requests",
    description: "Ideas for new cards, designs, or improvements",
  },
  {
    icon: Bug,
    title: "Bug Reports",
    description: "Something broken? Let me know via GitHub Issues",
    href: "https://github.com/RLAlpha49/AniCards/issues",
  },
  {
    icon: Sparkles,
    title: "Collaboration",
    description: "Partnerships, integrations, or creative projects",
  },
];

// Shared motion timing keeps the page feeling like one composed sequence rather
// than a stack of unrelated sections that all animate slightly differently.
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.15 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55 } },
};

const staggerGrid = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const gridItem = {
  hidden: { opacity: 0, scale: 0.95, y: 16 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export default function ContactPage() {
  usePageSEO("contact");

  const handleLinkClick = (platform: string) => {
    // Outbound navigation should never wait on analytics, so tracking here is
    // intentionally best-effort and silent on failure.
    safeTrack(() => trackExternalLinkClick(platform, "contact_page"));
  };

  return (
    <div className="relative min-h-screen">
      <div
        className="pointer-events-none absolute inset-0 opacity-30 dark:opacity-20"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0L60 30L30 60L0 30Z' fill='none' stroke='%23c9a84c15' stroke-width='1'/%3E%3C/svg%3E")`,
        }}
      />

      <section className="relative overflow-hidden px-6 pt-24 pb-12 sm:px-12 md:pt-32">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="relative z-10 mx-auto max-w-5xl"
        >
          <div className="grid items-end gap-10 md:grid-cols-[1fr_auto]">
            <div>
              <motion.p
                variants={itemVariants}
                className="text-gold mb-4 text-xs tracking-[0.5em] uppercase sm:text-sm"
              >
                Correspondence
              </motion.p>

              <motion.h1
                variants={itemVariants}
                className="font-display text-foreground mb-5 text-5xl leading-[1.05] font-black sm:text-6xl md:text-7xl lg:text-8xl"
              >
                GET IN
                <br />
                <span className="text-gold">TOUCH</span>
              </motion.h1>

              <motion.div
                variants={itemVariants}
                className="gold-line-thick mb-6 max-w-32"
              />

              <motion.p
                variants={itemVariants}
                className="font-body-serif text-foreground/55 max-w-md text-base leading-relaxed sm:text-lg"
              >
                Whether it&apos;s a question, idea, or just a quick hello
                &mdash; pick your preferred channel and reach out.
              </motion.p>
            </div>

            <motion.div
              variants={itemVariants}
              className="hidden md:block"
              aria-hidden="true"
            >
              <div className="border-gold/15 relative border-2 p-6">
                <div className="border-gold/10 border-2 p-5">
                  <Mail className="text-gold/30 h-20 w-20" strokeWidth={1} />
                </div>
                <div className="border-gold absolute -top-1.5 -left-1.5 h-3 w-3 border-t-2 border-l-2" />
                <div className="border-gold absolute -right-1.5 -bottom-1.5 h-3 w-3 border-r-2 border-b-2" />
              </div>
            </motion.div>
          </div>
        </motion.div>
      </section>

      <div className="gold-line-thick mx-auto max-w-[60%]" />

      <section className="px-6 py-16 sm:px-12 md:py-24">
        <div className="mx-auto max-w-5xl">
          <div className="mb-14 text-center">
            <div className="gold-ornament mb-6">
              <span className="text-gold text-lg">❖</span>
            </div>
            <h2 className="font-display text-foreground mb-3 text-sm tracking-[0.3em] uppercase">
              Ways to Reach Me
            </h2>
            <div className="gold-line mx-auto max-w-12" />
          </div>

          <div className="space-y-4">
            {CHANNELS.map((ch, index) => (
              <motion.div
                key={ch.name}
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ delay: index * 0.08, duration: 0.5 }}
              >
                <Link
                  href={ch.href}
                  target={ch.name === "email" ? undefined : "_blank"}
                  rel={ch.name === "email" ? undefined : "noopener noreferrer"}
                  onClick={() => handleLinkClick(ch.name)}
                  className="border-gold/10 hover:border-gold/30 bg-gold/2 hover:bg-gold/5 group flex items-center gap-5 border-2 p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_4px_24px_hsl(42_63%_55%/0.12)] sm:gap-8 sm:p-7"
                >
                  <span className="font-display text-gold/25 group-hover:text-gold/50 hidden min-w-10 text-center text-3xl transition-colors sm:block">
                    {ch.numeral}
                  </span>

                  <div className="bg-gold/15 hidden h-12 w-px sm:block" />

                  <div className="border-gold/15 group-hover:border-gold/35 shrink-0 border p-3 transition-colors">
                    <ch.icon size={22} className="text-gold" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <h3 className="font-display text-foreground mb-0.5 text-xs tracking-[0.2em] uppercase sm:text-sm">
                      {ch.label}
                    </h3>
                    <p className="font-body-serif text-foreground/45 text-xs leading-relaxed sm:text-sm">
                      {ch.tagline}
                    </p>
                  </div>

                  <div className="hidden items-center gap-3 md:flex">
                    <span className="text-gold/60 font-body-serif text-sm">
                      {ch.address}
                    </span>
                    <ArrowUpRight className="text-gold/30 group-hover:text-gold h-4 w-4 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </div>

                  <ArrowUpRight className="text-gold/30 group-hover:text-gold h-4 w-4 shrink-0 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 md:hidden" />
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-gold/20 border-y-2 px-6 py-16 sm:px-12 md:py-24">
        <div className="mx-auto max-w-5xl">
          <div className="mb-14 text-center">
            <h2 className="font-display text-foreground mb-3 text-sm tracking-[0.3em] uppercase">
              What Can I Help With?
            </h2>
            <div className="gold-line mx-auto max-w-12" />
          </div>

          <motion.div
            variants={staggerGrid}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            className="grid gap-5 sm:grid-cols-2"
          >
            {REASONS.map((reason) => {
              const content = (
                <>
                  <div className="mb-4 flex items-center gap-3">
                    <div className="border-gold/20 border p-2.5">
                      <reason.icon size={18} className="text-gold" />
                    </div>
                    <h3 className="font-display text-foreground text-xs tracking-[0.2em] uppercase">
                      {reason.title}
                    </h3>
                  </div>
                  <p className="font-body-serif text-foreground/50 text-sm leading-relaxed">
                    {reason.description}
                  </p>
                  {reason.href && (
                    <span className="text-gold mt-3 inline-flex items-center gap-1 text-xs tracking-wider uppercase">
                      Open Issue
                      <ExternalLink className="h-3 w-3" />
                    </span>
                  )}
                </>
              );

              return (
                <motion.div key={reason.title} variants={gridItem}>
                  {reason.href ? (
                    <Link
                      href={reason.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => handleLinkClick("github_issues")}
                      className="imperial-card group block h-full transition-all duration-300 hover:-translate-y-0.5"
                    >
                      {content}
                    </Link>
                  ) : (
                    <div className="imperial-card h-full">{content}</div>
                  )}
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      <section className="px-6 py-16 sm:px-12 md:py-24">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-3xl text-center"
        >
          <div className="gold-ornament mb-6">
            <span className="text-gold text-base">❖</span>
          </div>

          <h2 className="font-display text-gold mb-3 text-3xl sm:text-4xl">
            DIRECT LINE
          </h2>
          <div className="gold-line mx-auto mb-6 max-w-10" />
          <p className="font-body-serif text-foreground/50 mx-auto mb-10 max-w-md text-base leading-relaxed">
            For anything that warrants a longer conversation &mdash; detailed
            questions, collaboration proposals, or creative ideas.
          </p>

          <Link
            href="mailto:contact@alpha49.com"
            onClick={() => handleLinkClick("email")}
            className="imperial-btn imperial-btn-fill group inline-flex items-center"
          >
            <Send className="mr-2.5 h-4 w-4" />
            contact@alpha49.com
            <ArrowUpRight className="ml-2.5 h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>

          <p className="text-foreground/30 mt-6 text-xs tracking-wide">
            Typically responds within 24 &ndash; 48 hours
          </p>
        </motion.div>
      </section>
    </div>
  );
}
