import { Compass, Home, Search, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { NOINDEX_ROBOTS } from "@/lib/seo";

export const metadata: Metadata = {
  title: "404 - Page Not Found | AniCards",
  description:
    "The page you requested is not part of the AniCards route map. Head home, search for an AniList profile, or browse example cards instead.",
  robots: NOINDEX_ROBOTS,
};

const RECOVERY_LINKS = [
  {
    href: "/",
    label: "Back home",
    description:
      "Return to the main AniCards landing page and restart from the top.",
    icon: Home,
    tone: "fill",
  },
  {
    href: "/search",
    label: "Search profiles",
    description:
      "Jump straight to AniList profile lookup and generate fresh stat cards.",
    icon: Search,
    tone: "ghost",
  },
  {
    href: "/examples",
    label: "Browse examples",
    description:
      "Explore finished card types and variants to get back on track quickly.",
    icon: Sparkles,
    tone: "ghost",
  },
] as const;

export default function NotFound() {
  return (
    <main className="relative isolate overflow-hidden">
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-80"
        style={{
          background: `
            radial-gradient(circle at top, hsl(var(--gold) / 0.08), transparent 40%),
            linear-gradient(180deg, hsl(var(--background)) 0%, hsl(var(--background)) 100%)
          `,
        }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-30 dark:opacity-20"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg width='72' height='72' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M36 4L68 36L36 68L4 36Z' fill='none' stroke='%23b58a1e22' stroke-width='1'/%3E%3C/svg%3E\")",
        }}
      />

      <section className="
        mx-auto flex min-h-[70vh] w-full max-w-6xl items-center px-6 py-16
        sm:px-10
        lg:px-12
      ">
        <div className="
          imperial-card relative w-full overflow-hidden bg-background/95 shadow-2xl shadow-black/10
          backdrop-blur-sm
          dark:bg-card/95
        ">
          <div
            className="gold-line-thick absolute inset-x-0 top-0"
            aria-hidden="true"
          />

          <div className="
            relative grid gap-10
            lg:grid-cols-[minmax(0,1.3fr)_minmax(18rem,0.9fr)] lg:items-center
          ">
            <div className="space-y-8">
              <div className="space-y-4">
                <p className="font-display text-xs tracking-[0.4em] text-gold uppercase">
                  Error recovery · 404
                </p>
                <h1 className="
                  font-display text-4xl tracking-[0.08em] text-foreground
                  sm:text-5xl
                  lg:text-6xl
                ">
                  That route isn&apos;t in the deck.
                </h1>
                <p className="
                  max-w-3xl font-body-serif text-base/8 text-muted-foreground
                  sm:text-lg
                ">
                  The page you asked for doesn&apos;t exist, may have moved, or
                  was linked incorrectly. The good news: the rest of AniCards is
                  still very much online and ready to help you get back to
                  building.
                </p>
              </div>

              <div className="flex flex-wrap gap-4">
                <Link href="/" className="imperial-btn imperial-btn-fill">
                  Return home
                </Link>
                <Link
                  href="/search"
                  className="imperial-btn imperial-btn-ghost"
                >
                  Search AniList users
                </Link>
              </div>

              <div className="gold-line" aria-hidden="true" />

              <div className="grid gap-4 md:grid-cols-3">
                {RECOVERY_LINKS.map(
                  ({ href, label, description, icon: Icon, tone }) => (
                    <Link
                      key={href}
                      href={href}
                      className={[
                        "bento-cell group flex h-full flex-col gap-4 rounded-sm p-5 transition-transform duration-300 hover:-translate-y-1",
                        tone === "fill" ? "bg-[hsl(var(--gold)/0.06)]" : "",
                      ].join(" ")}
                    >
                      <span className="
                        inline-flex size-11 items-center justify-center rounded-full border
                        border-gold/20 bg-background/80 text-gold transition-colors
                        group-hover:border-gold/40 group-hover:bg-background
                      ">
                        <Icon className="size-5" />
                      </span>
                      <div className="space-y-2">
                        <p className="
                          font-display text-base tracking-[0.16em] text-foreground uppercase
                        ">
                          {label}
                        </p>
                        <p className="font-body-serif text-sm/7 text-muted-foreground">
                          {description}
                        </p>
                      </div>
                    </Link>
                  ),
                )}
              </div>
            </div>

            <aside className="
              relative overflow-hidden rounded-sm border border-gold/15 bg-[hsl(var(--gold)/0.04)]
              p-6
              sm:p-8
            ">
              <div
                className="gold-line absolute inset-x-0 top-0"
                aria-hidden="true"
              />
              <div className="space-y-6">
                <div>
                  <p className="font-display text-xs tracking-[0.35em] text-gold uppercase">
                    Route map
                  </p>
                  <div className="mt-4 flex items-center gap-3">
                    <span className="
                      inline-flex size-12 items-center justify-center rounded-full border
                      border-gold/25 bg-background/80 text-gold
                    ">
                      <Compass className="size-6" />
                    </span>
                    <div>
                      <p className="font-display text-3xl text-foreground">
                        404
                      </p>
                      <p className="font-body-serif text-sm/7 text-muted-foreground">
                        This URL didn&apos;t match a live page in the AniCards
                        app.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-sm border border-gold/10 bg-background/70 p-4">
                    <p className="font-display text-xs tracking-[0.3em] text-foreground uppercase">
                      Best next move
                    </p>
                    <p className="mt-2 font-body-serif text-sm/7 text-muted-foreground">
                      Start from <span className="text-foreground">Search</span>{" "}
                      if you meant to find a profile, or open{" "}
                      <span className="text-foreground">Examples</span> if you
                      wanted to browse card layouts first.
                    </p>
                  </div>

                  <ul className="space-y-3 font-body-serif text-sm/7 text-muted-foreground">
                    <li className="flex gap-3">
                      <span className="mt-2 size-1.5 shrink-0 rotate-45 bg-gold" />
                      <span>
                        Use the header navigation to jump between public pages.
                      </span>
                    </li>
                    <li className="flex gap-3">
                      <span className="mt-2 size-1.5 shrink-0 rotate-45 bg-gold" />
                      <span>
                        Old bookmarks can occasionally point to routes that no
                        longer exist.
                      </span>
                    </li>
                    <li className="flex gap-3">
                      <span className="mt-2 size-1.5 shrink-0 rotate-45 bg-gold" />
                      <span>
                        Search, home, and examples are the fastest recovery
                        points.
                      </span>
                    </li>
                  </ul>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </main>
  );
}
