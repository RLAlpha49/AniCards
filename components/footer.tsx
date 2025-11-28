"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { trackExternalLinkClick } from "@/lib/utils/google-analytics";
import { Mail, Heart, ExternalLink, Scale } from "lucide-react";
import {
  SimpleAniListIcon,
  SimpleDiscordIcon,
  SimpleGithubIcon,
} from "@/components/simple-icons";

/**
 * Social link metadata for the footer icons.
 * @source
 */
const SOCIAL_LINKS = [
  {
    href: "https://anilist.co/user/Alpha49",
    icon: SimpleAniListIcon,
    name: "anilist",
    label: "AniList Profile",
    hoverColor: "hover:text-blue-500 hover:border-blue-500/50",
    bgHover: "hover:bg-blue-500/10",
  },
  {
    href: "https://discordid.netlify.app/?id=251479989378220044",
    icon: SimpleDiscordIcon,
    name: "discord",
    label: "Discord",
    hoverColor: "hover:text-purple-500 hover:border-purple-500/50",
    bgHover: "hover:bg-purple-500/10",
  },
  {
    href: "mailto:contact@alpha49.com",
    icon: Mail,
    name: "email",
    label: "Email",
    hoverColor: "hover:text-green-500 hover:border-green-500/50",
    bgHover: "hover:bg-green-500/10",
  },
  {
    href: "https://github.com/RLAlpha49",
    icon: SimpleGithubIcon,
    name: "github",
    label: "GitHub",
    hoverColor:
      "hover:text-slate-900 dark:hover:text-white hover:border-slate-500/50",
    bgHover: "hover:bg-slate-500/10",
  },
];

/**
 * Page footer with license info, navigation links, and social icons.
 * - Shows the current year and a link to the project license.
 * - Features modern card styling with glassmorphism effects.
 * - Renders social/contact icons and reports link clicks to analytics.
 * @returns A responsive footer element.
 * @source
 */
export default function Footer() {
  return (
    <footer
      className={`relative z-50 border-t border-slate-200/50 bg-white/80 backdrop-blur-xl dark:border-slate-700/50 dark:bg-slate-950/80`}
    >
      {/* Subtle gradient line at the top */}
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-purple-500/50 to-transparent" />

      <div className="container p-5">
        <div className="flex flex-col items-center gap-8 md:flex-row md:justify-between">
          {/* Brand & Copyright */}
          <div className="flex flex-col items-center gap-4 md:items-start">
            {/* Logo */}
            <Link href="/" className="group flex items-center gap-2">
              <motion.div
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500"
                whileHover={{ scale: 1.05, rotate: 5 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
              >
                <Heart className="h-4 w-4 text-white" />
              </motion.div>
              <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-lg font-bold text-transparent">
                AniCards
              </span>
            </Link>

            {/* Copyright & License */}
            <div className="flex flex-wrap items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400 md:justify-start">
              <span>&copy; {new Date().getFullYear()} RLAlpha49</span>
              <span className="text-slate-300 dark:text-slate-600">•</span>
              <Link
                href="https://github.com/RLAlpha49/Anicards/blob/main/LICENSE"
                className="group inline-flex items-center gap-1.5 font-medium text-slate-600 transition-colors hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Scale className="h-3.5 w-3.5" />
                MIT Licensed
                <ExternalLink className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>
            </div>
          </div>

          {/* Social Links */}
          <div className="flex items-center gap-2">
            {SOCIAL_LINKS.map((link) => (
              <motion.div
                key={link.name}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
              >
                <Link
                  href={link.href}
                  target={link.name === "email" ? undefined : "_blank"}
                  rel={
                    link.name === "email" ? undefined : "noopener noreferrer"
                  }
                  className={`flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200/50 bg-white/50 text-slate-500 shadow-sm transition-all dark:border-slate-700/50 dark:bg-slate-800/50 dark:text-slate-400 ${link.hoverColor} ${link.bgHover}`}
                  onClick={() => trackExternalLinkClick(link.name, "footer")}
                  aria-label={link.label}
                >
                  <link.icon size={18} className="fill-current" />
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
