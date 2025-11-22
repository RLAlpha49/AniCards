"use client";

import React from "react";
import Link from "next/link";
import { trackExternalLinkClick } from "@/lib/utils/google-analytics";
import { Mail } from "lucide-react";
import {
  SimpleAniListIcon,
  SimpleDiscordIcon,
  SimpleGithubIcon,
} from "@/components/icons/simple-icons";
import { useIsMobile } from "@/hooks/use-mobile";

export default function Footer() {
  const isMobile = useIsMobile();

  return (
    <footer
      className={`border-t bg-background/80 py-6 backdrop-blur-md dark:bg-slate-950/80 ${
        isMobile ? "ml-0" : "ml-8"
      }`}
    >
      <div className="container flex flex-col items-center justify-between gap-4 md:flex-row">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>&copy; {new Date().getFullYear()} AniCards</span>
          <span>•</span>
          <Link
            href="https://github.com/RLAlpha49/Anicards/blob/main/LICENSE"
            className="font-medium hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            MIT Licensed
          </Link>
        </div>

        <div className="flex items-center gap-4">
          <Link
            href="https://anilist.co/user/Alpha49"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground transition-colors hover:text-blue-500"
            onClick={() => trackExternalLinkClick("anilist", "footer")}
            aria-label="AniList Profile"
          >
            <SimpleAniListIcon size={20} className="fill-current" />
          </Link>
          <Link
            href="https://discordid.netlify.app/?id=251479989378220044"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground transition-colors hover:text-purple-500"
            onClick={() => trackExternalLinkClick("discord", "footer")}
            aria-label="Discord"
          >
            <SimpleDiscordIcon size={20} className="fill-current" />
          </Link>
          <Link
            href="mailto:contact@alpha49.com"
            className="text-muted-foreground transition-colors hover:text-green-500"
            onClick={() => trackExternalLinkClick("email", "footer")}
            aria-label="Email"
          >
            <Mail className="h-5 w-5" />
          </Link>
          <Link
            href="https://github.com/RLAlpha49"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground transition-colors hover:text-gray-900 dark:hover:text-gray-100"
            onClick={() => trackExternalLinkClick("github", "footer")}
            aria-label="GitHub"
          >
            <SimpleGithubIcon size={20} />
          </Link>
        </div>
      </div>
    </footer>
  );
}
