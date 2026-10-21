"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import {
  trackExternalLinkClick,
  safeTrack,
} from "@/lib/utils/google-analytics";
import { Mail, ExternalLink, Scale } from "@/lib/icons";
import {
  SimpleAniListIcon,
  SimpleDiscordIcon,
  SimpleGithubIcon,
} from "@/components/SimpleIcons";
import { cn } from "@/lib/utils";
import { isHomePage } from "@/lib/page-theme";

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
  const pathname = usePathname();
  const isHome = isHomePage(pathname);

  return (
    <footer
      className={cn(
        "relative z-50 border-t backdrop-blur-xl",
        isHome
          ? "border-[#191512]/25 bg-[#f3e9d5]/95 dark:border-[#ece1c9]/25 dark:bg-[#16120f]/95"
          : "border-slate-200/50 bg-white/80 dark:border-slate-700/50 dark:bg-slate-950/80",
      )}
    >
      {/* Subtle gradient line at the top */}
      <div
        className={cn(
          "absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent to-transparent",
          isHome
            ? "via-[#b83a24]/50 dark:via-[#d4573c]/50"
            : "via-purple-500/50",
        )}
      />

      <div className="container p-5">
        <div className="flex flex-col items-center gap-8 md:flex-row md:justify-between">
          {/* Brand & Copyright */}
          <div className="flex flex-col items-center gap-4 md:items-start">
            {/* Copyright & License */}
            <div
              className={cn(
                "flex flex-wrap items-center justify-center gap-2 text-sm md:justify-start",
                isHome
                  ? "text-[#4d443a] dark:text-[#b6a88f]"
                  : "text-slate-500 dark:text-slate-400",
              )}
            >
              <span>&copy; {new Date().getFullYear()} RLAlpha49</span>
              <span
                className={cn(
                  isHome
                    ? "text-[#191512]/30 dark:text-[#ece1c9]/30"
                    : "text-slate-300 dark:text-slate-600",
                )}
              >
                •
              </span>
              <Link
                href="https://github.com/RLAlpha49/Anicards/blob/main/LICENSE"
                className={cn(
                  "group inline-flex items-center gap-1.5 font-medium transition-colors",
                  isHome
                    ? "text-[#191512] hover:text-[#b83a24] dark:text-[#ece1c9] dark:hover:text-[#d4573c]"
                    : "text-slate-600 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400",
                )}
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
                  className={cn(
                    "flex h-10 w-10 items-center justify-center border shadow-sm transition-all",
                    isHome
                      ? "rounded-none border-[#191512]/35 bg-transparent text-[#4d443a] hover:border-[#b83a24] hover:bg-transparent hover:text-[#b83a24] dark:border-[#ece1c9]/35 dark:text-[#b6a88f] dark:hover:border-[#d4573c] dark:hover:text-[#d4573c]"
                      : `rounded-xl border-slate-200/50 bg-white/50 text-slate-500 dark:border-slate-700/50 dark:bg-slate-800/50 dark:text-slate-400 ${link.hoverColor} ${link.bgHover}`,
                  )}
                  onClick={() =>
                    safeTrack(() => trackExternalLinkClick(link.name, "footer"))
                  }
                  aria-label={link.label}
                >
                  <link.icon size={18} />
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
