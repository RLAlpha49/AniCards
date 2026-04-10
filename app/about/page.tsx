import Link from "next/link";

import { MarketingBackdrop } from "@/components/marketing/MarketingBackdrop";
import { SectionReveal } from "@/components/marketing/SectionReveal";
import { StructuredDataScript } from "@/components/StructuredDataScript";
import { getRequestNonce } from "@/lib/request-nonce";
import { generateMetadata as createMetadata, seoConfigs } from "@/lib/seo";
import { generateStructuredData } from "@/lib/structured-data";

export const metadata = createMetadata(seoConfigs.about);

export default async function AboutPage() {
  const nonce = await getRequestNonce();

  return (
    <>
      <StructuredDataScript
        data={generateStructuredData("about")}
        nonce={nonce}
      />

      <div className="relative isolate overflow-hidden">
        <MarketingBackdrop />

        <section className="relative overflow-hidden px-6 pt-28 pb-20 sm:px-12 md:pt-40 md:pb-28">
          <div className="
            pointer-events-none absolute top-1/3 left-1/2 h-125 w-175 -translate-1/2
            bg-[hsl(var(--gold)/0.045)] blur-[140px]
          " />

          <div className="relative z-10 mx-auto max-w-6xl">
            <SectionReveal>
              <div className="mb-14 flex items-center gap-4">
                <div className="
                  h-px flex-1 bg-linear-to-r from-transparent to-[hsl(var(--gold)/0.2)]
                " />
                <div className="flex items-center gap-3">
                  <span className="block size-1.5 rotate-45 border border-[hsl(var(--gold)/0.4)]" />
                  <span className="
                    font-display text-[0.6rem] tracking-[0.5em] text-gold/45 uppercase
                    sm:text-[0.65rem]
                  ">
                    About AniCards
                  </span>
                  <span className="block size-1.5 rotate-45 border border-[hsl(var(--gold)/0.4)]" />
                </div>
                <div className="
                  h-px flex-1 bg-linear-to-l from-transparent to-[hsl(var(--gold)/0.2)]
                " />
              </div>
            </SectionReveal>

            <SectionReveal>
              <div className="text-center">
                <h1 className="
                  font-display text-[clamp(3rem,10vw,8rem)] leading-[0.88] font-black tracking-tight
                ">
                  <span className="block text-foreground">WHY</span>
                  <span className="block text-gold">ANICARDS</span>
                </h1>
              </div>
            </SectionReveal>

            <SectionReveal>
              <div className="
                mx-auto my-10 h-0.5 max-w-20 bg-linear-to-r from-transparent
                via-[hsl(var(--gold)/0.6)] to-transparent
              " />
            </SectionReveal>

            <SectionReveal>
              <div className="
                mx-auto max-w-3xl space-y-5 text-center font-body-serif text-base/7
                text-muted-foreground
                sm:text-lg/8
              ">
                <p>
                  AniCards exists because profile stats are usually more useful
                  than they are presentable. AniList exposes a rich public view
                  of anime and manga habits, but most people still have to piece
                  together that story from scattered counts, filters, and list
                  pages.
                </p>
                <p>
                  This project turns that public data into flexible card layouts
                  you can tune, reuse, and export without surrendering the parts
                  of your profile that were never meant to leave your control.
                  The result should feel polished enough to share, but grounded
                  enough that the underlying numbers still matter.
                </p>
                <p>
                  The ideal outcome is simple: you should be able to recognize a
                  taste pattern, a reading habit, or a seasonal swing in seconds
                  instead of manually stitching it together from several screens
                  and hoping you remembered what you saw two clicks ago.
                </p>
              </div>
            </SectionReveal>

            <SectionReveal>
              <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Link href="/search" className="imperial-btn imperial-btn-fill">
                  Open profile search
                </Link>
                <Link
                  href="/examples"
                  className="imperial-btn imperial-btn-ghost"
                >
                  Browse the gallery
                </Link>
                <Link
                  href="/contact"
                  className="imperial-btn imperial-btn-ghost"
                >
                  Get in touch
                </Link>
              </div>
            </SectionReveal>
          </div>
        </section>

        <section className="relative z-10 mx-auto mb-20 max-w-6xl px-6 sm:px-12">
          <SectionReveal>
            <div className="imperial-card space-y-5">
              <h2 className="
                font-display text-xl tracking-[0.08em] text-foreground uppercase
                sm:text-2xl
              ">
                Open source, privacy, and direct feedback
              </h2>
              <p className="
                max-w-3xl font-body-serif text-sm/relaxed text-foreground/45
                sm:text-base/relaxed
              ">
                If you want to understand the privacy posture, the{" "}
                <Link
                  href="/privacy"
                  className="
                    font-medium text-gold underline decoration-gold/30 underline-offset-4
                    transition-colors
                    hover:decoration-gold/70
                  "
                >
                  privacy disclosure
                </Link>{" "}
                summarizes the live behavior in plain English. If you would
                rather talk through an edge case, request a deletion, or suggest
                a new direction for the project, the{" "}
                <Link
                  href="/contact"
                  className="
                    font-medium text-gold underline decoration-gold/30 underline-offset-4
                    transition-colors
                    hover:decoration-gold/70
                  "
                >
                  contact page
                </Link>{" "}
                points you to the best route.
              </p>
              <p className="
                max-w-3xl font-body-serif text-sm/relaxed text-foreground/45
                sm:text-base/relaxed
              ">
                AniCards is happiest when the numbers stay readable, the tooling
                stays inspectable, and the finished cards still feel like they
                belong to the person sharing them.
              </p>
              <p className="
                max-w-3xl font-body-serif text-sm/relaxed text-foreground/45
                sm:text-base/relaxed
              ">
                That is also why the site keeps its scope narrow: better card
                generation, clearer exports, honest handling of public data, and
                feedback loops that stay close to the people actually using the
                thing.
              </p>
            </div>
          </SectionReveal>
        </section>
      </div>
    </>
  );
}
