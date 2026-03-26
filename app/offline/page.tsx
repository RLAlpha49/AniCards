import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: `Offline | AniCards`,
  description:
    "AniCards is offline. Cached public pages remain available while fresh AniList data waits for your connection.",
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
      "max-video-preview": -1,
      "max-image-preview": "none",
      "max-snippet": -1,
    },
  },
};

export default function OfflinePage() {
  return (
    <main className="
      mx-auto flex min-h-[70vh] w-full max-w-5xl items-center px-6 py-16
      sm:px-10
      lg:px-12
    ">
      <section className="
        imperial-card w-full space-y-8 bg-background/95 shadow-2xl shadow-black/10 backdrop-blur-sm
        dark:bg-card/95
      ">
        <div className="space-y-3">
          <p className="font-display text-xs tracking-[0.35em] text-[hsl(var(--gold))] uppercase">
            Offline shell
          </p>
          <h1 className="font-display text-4xl tracking-[0.08em] text-foreground sm:text-5xl">
            You&apos;re offline
          </h1>
          <p className="max-w-3xl text-base/8 text-muted-foreground sm:text-lg">
            Cached public pages and the install shell are still here, but fresh
            AniList lookups, new card renders, and live profile data need a
            connection.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="bento-cell rounded-sm p-5">
            <h2 className="font-display text-lg tracking-[0.16em] text-foreground uppercase">
              What still works
            </h2>
            <p className="mt-3 text-sm/7 text-muted-foreground">
              Previously cached public pages, the shared navigation shell, and
              install metadata remain available for quick return visits.
            </p>
          </div>

          <div className="bento-cell rounded-sm p-5">
            <h2 className="font-display text-lg tracking-[0.16em] text-foreground uppercase">
              What needs the network
            </h2>
            <p className="mt-3 text-sm/7 text-muted-foreground">
              User searches, AniList sync, and new stat card generation will
              resume automatically once you reconnect.
            </p>
          </div>
        </div>

        <div className="gold-line-thick" aria-hidden="true" />

        <div className="flex flex-col gap-4 sm:flex-row">
          <Link href="/" className="imperial-btn imperial-btn-fill">
            Back home
          </Link>
          <Link href="/search" className="imperial-btn imperial-btn-ghost">
            Search when reconnected
          </Link>
        </div>
      </section>
    </main>
  );
}
