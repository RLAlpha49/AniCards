import Link from "next/link";

import { MarketingBackdrop } from "@/components/marketing/MarketingBackdrop";
import { SectionReveal } from "@/components/marketing/SectionReveal";
import { StructuredDataScript } from "@/components/StructuredDataScript";
import { SHOW_LOADING_PREVIEW } from "@/lib/dev-loading-preview";
import { getRequestNonce } from "@/lib/request-nonce";
import { generateMetadata as createMetadata, seoConfigs } from "@/lib/seo";
import { generateStructuredData } from "@/lib/structured-data";

import LoadingPreview from "./loading";

export const metadata = createMetadata(seoConfigs.privacy);

const sections = [
  {
    id: "data-collection",
    ordinal: "01",
    heading: "Data Collection",
    lead: "Here's the short version of what actually lands in our database.",
    paragraphs: [
      "When you use AniCards, we may store a trimmed snapshot of your AniList profile alongside your card settings and your consent decision for Google Analytics. That last one is off by default — it only switches on if you accept it.",
      "Whenever your browser logs an error, AniCards only accepts the report from a page carrying a server-issued request proof. Before anything touches storage, we strip identifiers, normalize routes, scrub stack details, and redact secret-looking text or metadata. Your identity has no business being attached to a stack trace.",
    ],
  },
  {
    id: "telemetry",
    ordinal: "02",
    heading: "Telemetry",
    lead: "Analytics only kicks in when you say so.",
    paragraphs: [
      "If you've consented, Google Analytics fires on normalized route patterns — something like /user/* rather than your actual username. We deliberately stay away from capturing raw browsing trails.",
      "Vercel's own performance telemetry runs separately and is always privacy-safe. No personal identifiers, ever. Just latency numbers and the occasional server health signal.",
    ],
  },
  {
    id: "retention",
    ordinal: "03",
    heading: "Retention & Limits",
    lead: "Everything has a ceiling. Nothing lingers indefinitely.",
    items: [
      {
        label: "User data",
        detail:
          "Lives until you overwrite it, manually deleted, or the automated cleanup catches it going stale.",
      },
      {
        label: "Analytics",
        detail:
          "Rotates into monthly buckets with a ~400-day TTL — roughly 13 months of raw retention before counters expire.",
      },
      {
        label: "Error reports",
        detail:
          "Hard cap at 250 entries. Oldest records get pushed out as new ones arrive.",
      },
      {
        label: "Audit logs",
        detail: "Same deal — server lifecycle entries are capped at 250.",
      },
      {
        label: "Failure counters",
        detail:
          "Expire after 14 days. Hit three consecutive AniList 404s within that window and the stored user record gets cleaned up automatically.",
      },
    ],
  },
  {
    id: "your-rights",
    ordinal: "04",
    heading: "Deletion & Export",
    lead: "Manual for now — reach out anytime.",
    paragraphs: [
      "There is no public self-serve export or deletion flow yet. For manual requests, email contact@alpha49.com and we'll handle it directly.",
    ],
  },
] as const;

const tocItems = sections.map((s) => ({ id: s.id, label: s.heading }));

export default async function PrivacyPage() {
  if (SHOW_LOADING_PREVIEW) {
    return <LoadingPreview />;
  }

  const nonce = await getRequestNonce();

  return (
    <>
      <StructuredDataScript
        data={generateStructuredData("privacy")}
        nonce={nonce}
      />

      <div className="relative isolate overflow-hidden">
        <MarketingBackdrop />

        {/* ── Hero ── */}
        <section className="relative overflow-hidden px-6 pt-28 pb-20 sm:px-12 md:pt-40 md:pb-28">
          {/* Centered radial glow */}
          <div className="
            pointer-events-none absolute top-1/3 left-1/2 h-125 w-175 -translate-1/2
            bg-[hsl(var(--gold)/0.04)] blur-[140px]
          " />

          <div className="relative z-10 mx-auto max-w-6xl">
            {/* Decorative top frame */}
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
                    Privacy Disclosure
                  </span>
                  <span className="block size-1.5 rotate-45 border border-[hsl(var(--gold)/0.4)]" />
                </div>
                <div className="
                  h-px flex-1 bg-linear-to-l from-transparent to-[hsl(var(--gold)/0.2)]
                " />
              </div>
            </SectionReveal>

            {/* Oversized stacked headline */}
            <SectionReveal>
              <div className="text-center">
                <h1 className="
                  font-display text-[clamp(3rem,11vw,9rem)] leading-[0.85] font-black tracking-tight
                ">
                  <span className="block text-foreground">YOUR</span>
                  <span className="block text-gold">DATA</span>
                </h1>
              </div>
            </SectionReveal>

            {/* Gold separator */}
            <SectionReveal>
              <div className="
                mx-auto my-10 h-0.5 max-w-20 bg-linear-to-r from-transparent
                via-[hsl(var(--gold)/0.6)] to-transparent
              " />
            </SectionReveal>

            {/* Subtitle */}
            <SectionReveal>
              <p className="
                mx-auto max-w-xl text-center text-base/7 text-muted-foreground
                sm:text-lg/8
              ">
                This is a plain-language disclosure, not a legal privacy policy.
                <br className="hidden sm:block" />
                The sections below cover the current storage, telemetry,
                retention, and deletion behavior in one place.
              </p>
            </SectionReveal>
          </div>
        </section>

        {/* ── Full-width divider ── */}
        <SectionReveal
          variant="lineExpand"
          className="
            mx-auto h-px max-w-[min(90%,72rem)] origin-center bg-linear-to-r from-transparent
            via-gold/20 to-transparent
          "
        />

        {/* ── Content grid: TOC + sections ── */}
        <div className="
          relative z-10 mx-auto grid w-full max-w-6xl gap-x-20 gap-y-12 px-6 py-16
          sm:px-12
          lg:grid-cols-[13rem_1fr] lg:py-24
        ">
          {/* Sidebar TOC — sticky on desktop */}
          <SectionReveal>
            <nav
              aria-label="On this page"
              className="hidden lg:sticky lg:top-28 lg:block lg:self-start"
            >
              <p className="
                mb-5 font-display text-[0.6rem] tracking-[0.4em] text-muted-foreground uppercase
              ">
                Contents
              </p>
              <ol className="space-y-4 border-l-2 border-gold/15 pl-5">
                {tocItems.map((t, i) => (
                  <li key={t.id}>
                    <a
                      href={`#${t.id}`}
                      className="
                        group flex items-baseline gap-3 text-sm text-muted-foreground
                        transition-colors
                        hover:text-gold
                      "
                    >
                      <span className="
                        font-display text-[0.6rem] tracking-[0.2em] text-gold/30 transition-colors
                        group-hover:text-gold/60
                      ">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      {t.label}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          </SectionReveal>

          {/* Sections column */}
          <div className="space-y-24 lg:space-y-28">
            {sections.map((section) => (
              <SectionReveal key={section.id}>
                <section
                  id={section.id}
                  aria-labelledby={`heading-${section.id}`}
                  className="scroll-mt-24"
                >
                  {/* Ordinal + heading group */}
                  <div className="flex items-start gap-6">
                    {/* Large ordinal with vertical line accent */}
                    <div className="relative shrink-0 pt-1">
                      <div className="absolute top-0 left-0 h-full w-0.5 bg-gold/20" />
                      <span
                        aria-hidden="true"
                        className="
                          block pl-4 font-display text-[3rem] leading-none font-normal
                          tracking-tight text-gold/15 select-none
                          sm:text-[4rem]
                        "
                      >
                        {section.ordinal}
                      </span>
                    </div>
                    <div className="space-y-2 pt-2">
                      <h2
                        id={`heading-${section.id}`}
                        className="
                          font-display text-xl tracking-[0.04em] text-foreground uppercase
                          sm:text-2xl
                        "
                      >
                        {section.heading}
                      </h2>
                      <p className="text-sm text-muted-foreground sm:text-base">
                        {section.lead}
                      </p>
                    </div>
                  </div>

                  {/* Thin rule under heading */}
                  <div className="mt-6 h-px w-full bg-gold/10" />

                  {/* Paragraphs (sections 01, 02, 04) */}
                  {"paragraphs" in section && (
                    <div className="mt-8 max-w-2xl space-y-5">
                      {section.paragraphs.map((p) => (
                        <p
                          key={p}
                          className="text-[0.938rem]/7 text-muted-foreground sm:text-base/7"
                        >
                          {p}
                        </p>
                      ))}
                      {section.id === "your-rights" && (
                        <p className="text-[0.938rem]/7 text-muted-foreground sm:text-base/7">
                          Contact{" "}
                          <Link
                            href="mailto:contact@alpha49.com"
                            className="
                              font-medium text-gold underline decoration-gold/30 underline-offset-4
                              transition-colors
                              hover:decoration-gold/70
                            "
                          >
                            contact@alpha49.com
                          </Link>
                        </p>
                      )}
                    </div>
                  )}

                  {/* Data table (section 03) — sharp corners, imperial style */}
                  {"items" in section && (
                    <div className="
                      mt-8 overflow-hidden border border-gold/12 bg-background/60 backdrop-blur-sm
                    ">
                      <table className="w-full text-left text-sm sm:text-base">
                        <thead>
                          <tr className="border-b border-gold/10 bg-gold/4">
                            <th className="
                              px-6 py-3.5 font-display text-[0.6rem] tracking-[0.3em]
                              text-muted-foreground uppercase
                              sm:text-xs
                            ">
                              Category
                            </th>
                            <th className="
                              px-6 py-3.5 font-display text-[0.6rem] tracking-[0.3em]
                              text-muted-foreground uppercase
                              sm:text-xs
                            ">
                              Retention
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gold/8">
                          {section.items.map((row) => (
                            <tr key={row.label} className="group">
                              <td className="
                                w-1/4 px-6 py-4 align-top font-medium text-foreground
                                transition-colors
                                group-hover:text-gold
                              ">
                                {row.label}
                              </td>
                              <td className="px-6 py-4 text-muted-foreground">
                                {row.detail}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </SectionReveal>
            ))}
          </div>
        </div>

        {/* ── Footer CTA band ── */}
        <SectionReveal>
          <div className="relative z-10 mx-auto mb-20 max-w-6xl px-6 sm:px-12">
            <div className="imperial-card">
              <div className="
                flex flex-col items-start gap-8
                sm:flex-row sm:items-center sm:justify-between
              ">
                <div className="space-y-2">
                  <h2 className="
                    font-display text-lg tracking-[0.06em] text-foreground uppercase
                    sm:text-xl
                  ">
                    Got questions about your data?
                  </h2>
                  <p className="max-w-md text-sm text-muted-foreground sm:text-base">
                    No self-serve portal yet — but we're not hard to reach, and
                    we handle every request personally.
                  </p>
                </div>
                <Link
                  href="mailto:contact@alpha49.com"
                  className="imperial-btn imperial-btn-ghost"
                >
                  Get in touch
                  <svg
                    aria-hidden="true"
                    className="ml-3 size-3.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4.5 12h15m0 0l-6.75-6.75M19.5 12l-6.75 6.75"
                    />
                  </svg>
                </Link>
              </div>
            </div>
          </div>
        </SectionReveal>
      </div>
    </>
  );
}
