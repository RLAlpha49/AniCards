import { ExternalLink, GitFork, Star } from "lucide-react";
import Link from "next/link";

import { SimpleGithubIcon } from "./SimpleIcons";

/** Gold L-shaped corner accents — the imperial framing motif. */
function CornerAccents() {
  const h = "absolute bg-gold/50 h-px w-2";
  const v = "absolute bg-gold/50 w-px h-2";
  return (
    <>
      <span className={`${h} top-0 left-0`} aria-hidden="true" />
      <span className={`${v} top-0 left-0`} aria-hidden="true" />
      <span className={`${h} top-0 right-0`} aria-hidden="true" />
      <span className={`${v} top-0 right-0`} aria-hidden="true" />
      <span className={`${h} bottom-0 left-0`} aria-hidden="true" />
      <span className={`${v} bottom-0 left-0`} aria-hidden="true" />
      <span className={`${h} right-0 bottom-0`} aria-hidden="true" />
      <span className={`${v} right-0 bottom-0`} aria-hidden="true" />
    </>
  );
}

/** Horizontal rule with centered gold diamond ornament. */
function OrnamentalRule() {
  return (
    <div className="flex items-center gap-2.5 py-1.5" aria-hidden="true">
      <div className="h-px flex-1 bg-gold/15" />
      <span className="inline-block size-1 rotate-45 bg-gold/50" />
      <div className="h-px flex-1 bg-gold/15" />
    </div>
  );
}

/**
 * Floating imperial-styled GitHub CTA with an expandable info panel.
 * Matches the site's gold/geometric aesthetic with sharp corners,
 * corner accent marks, and refined serif typography.
 * @source
 */
export default function GithubCorner() {
  return (
    <div className="
      fixed top-20 right-5 z-1000
      motion-safe:animate-in motion-safe:duration-700 motion-safe:fade-in-0
      motion-safe:slide-in-from-right-4
    ">
      <div className="group relative">
        <Link
          href="https://github.com/RLAlpha49/Anicards"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="View AniCards on GitHub"
          className="
            relative flex size-12 items-center justify-center border border-gold/20 bg-white/90
            backdrop-blur-sm transition-all duration-300
            hover:border-gold/40 hover:shadow-[0_0_24px_-6px_hsl(42_58%_42%/0.15)]
            focus-visible:ring-2 focus-visible:ring-gold/50 focus-visible:ring-offset-2
            focus-visible:outline-none
            dark:border-gold/15 dark:bg-[#0C0A10]/90
            dark:hover:border-gold/35 dark:hover:shadow-[0_0_24px_-6px_hsl(42_63%_55%/0.2)]
          "
        >
          <CornerAccents />
          <SimpleGithubIcon
            size={22}
            className="
              text-foreground/50 transition-colors duration-300
              group-hover:text-gold
              dark:text-foreground/40
              dark:group-hover:text-gold
            "
          />
        </Link>

        <div className="
          pointer-events-none absolute -top-1.5 -right-1.5
          motion-safe:animate-pulse motion-safe:animation-duration-[2s]
          motion-reduce:animate-none
        ">
          <Star className="size-3 fill-gold text-gold drop-shadow-sm" />
        </div>

        <div className="
          pointer-events-none invisible absolute top-0 right-full mr-3 translate-x-2 opacity-0
          transition-all duration-200
          group-focus-within:pointer-events-auto group-focus-within:visible
          group-focus-within:translate-x-0 group-focus-within:opacity-100
          group-hover:pointer-events-auto group-hover:visible group-hover:translate-x-0
          group-hover:opacity-100
          motion-reduce:transition-none
        ">
          <div className="
            relative w-52 border border-gold/20 bg-white/95 backdrop-blur-sm
            dark:border-gold/15 dark:bg-[#0C0A10]/95
          ">
            <CornerAccents />

            <div
              className="
                absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-gold/40
                to-transparent
              "
              aria-hidden="true"
            />

            <div className="p-4">
              <div className="mb-0.5 flex items-center gap-2.5">
                <SimpleGithubIcon size={15} className="shrink-0 text-gold/60" />
                <div className="min-w-0">
                  <p className="font-display text-[11px] leading-tight tracking-[0.2em] text-gold">
                    ANICARDS
                  </p>
                  <p className="
                    font-body-serif text-[10px] tracking-wide text-foreground/40
                    dark:text-foreground/30
                  ">
                    by RLAlpha49
                  </p>
                </div>
              </div>

              <OrnamentalRule />

              <p className="
                mb-3 font-body-serif text-[11px] leading-relaxed text-foreground/50
                dark:text-foreground/40
              ">
                Beautiful stat cards for your AniList profile
              </p>

              <div className="flex gap-2">
                <Link
                  href="https://github.com/RLAlpha49/Anicards"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Star AniCards on GitHub"
                  className="
                    flex flex-1 items-center justify-center gap-1.5 border border-gold bg-gold px-3
                    py-1.5 text-[11px] font-semibold tracking-wide text-white transition-colors
                    duration-200
                    hover:border-gold-dim hover:bg-gold-dim
                    focus-visible:ring-2 focus-visible:ring-gold/50 focus-visible:outline-none
                  "
                >
                  <Star className="size-3 fill-current" />
                  Star
                </Link>
                <Link
                  href="https://github.com/RLAlpha49/Anicards/fork"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Fork AniCards on GitHub"
                  className="
                    flex flex-1 items-center justify-center gap-1.5 border border-gold/25
                    bg-transparent px-3 py-1.5 text-[11px] font-semibold tracking-wide
                    text-foreground/60 transition-colors duration-200
                    hover:border-gold/40 hover:text-gold
                    focus-visible:ring-2 focus-visible:ring-gold/50 focus-visible:outline-none
                    dark:border-gold/20 dark:text-foreground/45
                    dark:hover:border-gold/35 dark:hover:text-gold
                  "
                >
                  <GitFork className="size-3" />
                  Fork
                </Link>
              </div>

              <OrnamentalRule />

              <Link
                href="https://github.com/RLAlpha49/Anicards"
                target="_blank"
                rel="noopener noreferrer"
                className="
                  flex items-center justify-center gap-1.5 font-body-serif text-[10px]
                  tracking-[0.15em] text-foreground/35 transition-colors duration-200
                  hover:text-gold
                  dark:text-foreground/30
                  dark:hover:text-gold
                "
              >
                VIEW REPOSITORY
                <ExternalLink className="size-2.5" />
              </Link>
            </div>

            <div className="absolute top-4.75 right-0 translate-x-1.25">
              <div className="
                size-2.5 rotate-45 border-t border-r border-gold/20 bg-white/95
                dark:border-gold/15 dark:bg-[#0C0A10]/95
              " />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
