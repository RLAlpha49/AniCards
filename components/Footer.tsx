"use client";

import { motion } from "framer-motion";
import { ExternalLink, Mail, Scale } from "lucide-react";
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

const SOCIAL_LINKS = [
  {
    href: "https://anilist.co/user/Alpha49",
    icon: SimpleAniListIcon,
    name: "anilist",
    label: "AniList Profile",
  },
  {
    href: "https://discordid.netlify.app/?id=251479989378220044",
    icon: SimpleDiscordIcon,
    name: "discord",
    label: "Discord",
  },
  {
    href: "mailto:contact@alpha49.com",
    icon: Mail,
    name: "email",
    label: "Email",
  },
  {
    href: "https://github.com/RLAlpha49",
    icon: SimpleGithubIcon,
    name: "github",
    label: "GitHub",
  },
];

export default function Footer() {
  return (
    <motion.footer
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="relative border-t border-gold/30 bg-white dark:bg-[#0C0A10]"
    >
      <div className="
        absolute inset-x-0 top-0 h-0.5 bg-linear-to-r from-transparent via-gold/50 to-transparent
      " />

      <div className="px-8 py-6 sm:px-12">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <motion.div
            className="flex flex-wrap items-center gap-2 text-xs tracking-widest"
            initial={{ opacity: 0, y: 6 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.5, ease: EASE_OUT_EXPO, delay: 0.3 }}
          >
            <span className="font-display text-foreground/30">
              © {new Date().getFullYear()} ANICARDS
            </span>
            <span className="text-gold/30">•</span>
            <Link
              href="https://github.com/RLAlpha49/Anicards/blob/main/LICENSE"
              className="
                group inline-flex items-center gap-1 font-body-serif text-foreground/40
                transition-colors
                hover:text-gold
              "
              target="_blank"
              rel="noopener noreferrer"
            >
              <Scale className="size-3" />
              MIT Licensed
              <ExternalLink className="
                size-2.5 opacity-0 transition-opacity
                group-hover:opacity-100
              " />
            </Link>
          </motion.div>

          <motion.div
            className="flex items-center gap-3"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-40px" }}
            variants={{
              hidden: {},
              visible: {
                transition: { staggerChildren: 0.08, delayChildren: 0.15 },
              },
            }}
          >
            {SOCIAL_LINKS.map((link) => (
              <motion.div
                key={link.name}
                variants={{
                  hidden: { opacity: 0, scale: 0.85 },
                  visible: {
                    opacity: 1,
                    scale: 1,
                    transition: { duration: 0.35, ease: EASE_OUT_EXPO },
                  },
                }}
                whileHover={{ scale: 1.15 }}
                transition={{ duration: 0.2 }}
              >
                <Link
                  href={link.href}
                  target={link.name === "email" ? undefined : "_blank"}
                  rel={
                    link.name === "email" ? undefined : "noopener noreferrer"
                  }
                  className="
                    flex size-9 items-center justify-center border border-gold/15 text-foreground/40
                    transition-all
                    hover:border-gold/40 hover:text-gold
                  "
                  onClick={() =>
                    safeTrack(() => trackExternalLinkClick(link.name, "footer"))
                  }
                  aria-label={link.label}
                >
                  <link.icon size={16} />
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </motion.footer>
  );
}
