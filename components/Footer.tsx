"use client";

import { ExternalLink, Mail, Scale, Shield } from "lucide-react";
import Link from "next/link";

import {
  SimpleAniListIcon,
  SimpleDiscordIcon,
  SimpleGithubIcon,
} from "@/components/SimpleIcons";
import {
  safeTrack,
  trackExternalLinkClick,
  trackNavigation,
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
    <footer className="relative border-t border-gold/30 bg-white dark:bg-[#0C0A10]">
      <div className="
        absolute inset-x-0 top-0 h-0.5 bg-linear-to-r from-transparent via-gold/50 to-transparent
      " />

      <div className="px-8 py-6 sm:px-12">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2 text-xs tracking-widest">
            <span className="font-display text-foreground/30">
              © {new Date().getFullYear()} ANICARDS
            </span>
            <span className="text-gold/30">•</span>
            <Link
              href="https://github.com/RLAlpha49/Anicards/blob/main/LICENSE"
              className="
                group inline-flex items-center gap-1 rounded-sm font-body-serif text-foreground/40
                transition-colors
                hover:text-gold
                focus-visible:text-gold focus-visible:ring-2 focus-visible:ring-gold/50
                focus-visible:ring-offset-2 focus-visible:ring-offset-background
                focus-visible:outline-none
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
            <span className="text-gold/30">•</span>
            <Link
              href="/privacy"
              className="
                inline-flex items-center gap-1 rounded-sm font-body-serif text-foreground/40
                transition-colors
                hover:text-gold
                focus-visible:text-gold focus-visible:ring-2 focus-visible:ring-gold/50
                focus-visible:ring-offset-2 focus-visible:ring-offset-background
                focus-visible:outline-none
              "
              onClick={() =>
                safeTrack(() => trackNavigation("privacy", "footer"))
              }
            >
              <Shield className="size-3" />
              Privacy Disclosure
            </Link>
          </div>

          <div className="flex items-center gap-3">
            {SOCIAL_LINKS.map((link) => (
              <div
                key={link.name}
                className="
                  transition-transform duration-200
                  motion-safe:hover:scale-[1.15]
                  motion-reduce:transition-none
                "
              >
                <Link
                  href={link.href}
                  target={link.name === "email" ? undefined : "_blank"}
                  rel={
                    link.name === "email" ? undefined : "noopener noreferrer"
                  }
                  className="
                    flex size-11 items-center justify-center rounded-full border border-gold/15
                    text-foreground/40 transition-all
                    hover:border-gold/40 hover:text-gold
                    focus-visible:border-gold/40 focus-visible:text-gold focus-visible:ring-2
                    focus-visible:ring-gold/50 focus-visible:ring-offset-2
                    focus-visible:ring-offset-background focus-visible:outline-none
                    md:size-9 md:rounded-none
                  "
                  onClick={() =>
                    safeTrack(() => trackExternalLinkClick(link.name, "footer"))
                  }
                  aria-label={link.label}
                >
                  <link.icon size={16} />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
