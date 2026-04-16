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
    lead: "Here's the short version of what is stored — and what stays in your browser.",
    paragraphs: [
      "When you save data, AniCards may store a trimmed snapshot of your AniList profile alongside your card settings. Google Analytics consent is not copied into those server-side records — it lives in browser storage only, and it starts in the off state.",
      "Protected write routes and client error reports use a short-lived server-issued request proof cookie. Its readable payload carries a signed expiry plus hashed network and browser bindings — not your raw IP address or full user-agent string — and any accepted error report is minimized before it reaches storage.",
    ],
  },
  {
    id: "telemetry",
    ordinal: "02",
    heading: "Telemetry",
    lead: "Analytics only kicks in when you say so.",
    paragraphs: [
      "If you've consented, Google Analytics sends normalized pageviews and bounded events on route patterns like /user/* instead of raw profile URLs. We deliberately stay away from replaying your full browsing trail.",
      "Runtime telemetry such as Vercel Analytics and Speed Insights is separate from Google Analytics consent. If a client error report cannot be delivered right away, AniCards can keep the same minimized payload in a capped local or session storage retry queue until it succeeds or expires.",
    ],
  },
  {
    id: "retention",
    ordinal: "03",
    heading: "Retention & Limits",
    lead: "Everything has a ceiling, a window, or both.",
    items: [
      {
        label: "User data",
        detail:
          "Saved snapshots and card settings stay until you overwrite them, maintainers delete them, or stale-user cleanup removes a record after three scheduled AniList 404s inside a 14-day failure window.",
      },
      {
        label: "Analytics consent",
        detail:
          "Lives in browser storage only until you change your choice or clear browser storage.",
      },
      {
        label: "Client error retry queue",
        detail:
          "Stores only minimized error payloads in localStorage when available, otherwise sessionStorage. The queue is capped and entries expire after 7 days, or sooner if they are delivered or evicted.",
      },
      {
        label: "Analytics counters",
        detail:
          "Rotates into monthly buckets with a ~400-day TTL — roughly 13 months of raw retention before counters expire.",
      },
      {
        label: "Analytics reports",
        detail:
          "Generated analytics reports are capped at 50 and each stored report ages out after 14 days. Persisted observability history keeps aggregate envelopes and compact rolling error counts, not detailed retained/evicted error triage snapshots.",
      },
      {
        label: "Error reports",
        detail:
          "Server-side structured error reports age out after 14 days, the live buffer stays capped at 250 retained entries, and the cron-facing rolling error aggregate stays inside that same 14-day window.",
      },
      {
        label: "Audit logs",
        detail:
          "Server-side lifecycle audit entries age out after 14 days, and the live list stays capped at 250 entries.",
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

function PrivacyTableOfContents({
  compact = false,
}: Readonly<{ compact?: boolean }>) {
  return (
    <ol
      className={
        compact ? "space-y-2" : "space-y-4 border-l-2 border-gold/15 pl-5"
      }
    >
      {tocItems.map((item, index) => (
        <li key={item.id}>
          <a
            href={`#${item.id}`}
            className={
              compact
                ? `
                  group flex min-h-11 items-center gap-3 rounded-sm px-3 py-2 text-sm
                  text-muted-foreground transition-colors
                  hover:bg-gold/5 hover:text-gold
                  focus-visible:outline-2 focus-visible:outline-offset-2
                  focus-visible:outline-gold/50
                `
                : `
                  group flex items-baseline gap-3 text-sm text-muted-foreground transition-colors
                  hover:text-gold
                  focus-visible:outline-2 focus-visible:outline-offset-2
                  focus-visible:outline-gold/50
                `
            }
          >
            <span className="
              font-display text-[0.6rem] tracking-[0.2em] text-gold/30 transition-colors
              group-hover:text-gold/60
            ">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span>{item.label}</span>
          </a>
        </li>
      ))}
    </ol>
  );
}

function MobileRetentionCards({
  items,
}: Readonly<{
  items: ReadonlyArray<{ label: string; detail: string }>;
}>) {
  return (
    <div data-testid="privacy-retention-cards" className="space-y-4 md:hidden">
      {items.map((row) => (
        <article
          key={row.label}
          className="border border-gold/12 bg-background/60 p-4 backdrop-blur-sm"
        >
          <div className="flex items-start justify-between gap-4">
            <h3 className="text-base font-medium text-foreground">
              {row.label}
            </h3>
            <span
              aria-hidden="true"
              className="
                rounded-full border border-gold/15 px-2.5 py-1 font-display text-[0.55rem]
                tracking-[0.25em] text-muted-foreground uppercase
              "
            >
              Retention
            </span>
          </div>
          <p className="mt-3 text-sm/relaxed text-muted-foreground">
            {row.detail}
          </p>
        </article>
      ))}
    </div>
  );
}

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
              <PrivacyTableOfContents />
            </nav>
          </SectionReveal>

          <SectionReveal>
            <nav aria-label="On this page" className="lg:hidden">
              <details
                data-testid="privacy-mobile-toc"
                className="border border-gold/12 bg-background/60 backdrop-blur-sm"
              >
                <summary className="
                  flex min-h-11 cursor-pointer touch-manipulation-safe list-none items-center
                  justify-between gap-4 px-4 py-3
                  focus-visible:outline-2 focus-visible:outline-offset-2
                  focus-visible:outline-gold/50
                  [&::-webkit-details-marker]:hidden
                ">
                  <div>
                    <p className="
                      font-display text-[0.6rem] tracking-[0.35em] text-muted-foreground uppercase
                    ">
                      On this page
                    </p>
                    <p className="mt-1 text-sm text-foreground/80">
                      Jump to any section without the long scroll.
                    </p>
                  </div>
                  <span className="
                    shrink-0 rounded-full border border-gold/15 px-2.5 py-1 font-display
                    text-[0.55rem] tracking-[0.25em] text-gold/75 uppercase
                  ">
                    {tocItems.length} sections
                  </span>
                </summary>

                <div className="border-t border-gold/10 p-4">
                  <PrivacyTableOfContents compact />
                </div>
              </details>
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
                    <div className="mt-8 space-y-4">
                      <MobileRetentionCards items={section.items} />

                      <div
                        data-testid="privacy-retention-table"
                        aria-label="Retention limits table"
                        tabIndex={0}
                        className="
                          hidden overflow-x-auto border border-gold/12 bg-background/60
                          backdrop-blur-sm
                          md:block
                        "
                      >
                        <table className="w-full min-w-2xl text-left text-sm sm:text-base">
                          <caption className="sr-only">
                            Retention limits and cleanup windows for stored
                            AniCards data.
                          </caption>
                          <thead>
                            <tr className="border-b border-gold/10 bg-gold/4">
                              <th
                                scope="col"
                                className="
                                  px-6 py-3.5 font-display text-[0.6rem] tracking-[0.3em]
                                  text-muted-foreground uppercase
                                  sm:text-xs
                                "
                              >
                                Category
                              </th>
                              <th
                                scope="col"
                                className="
                                  px-6 py-3.5 font-display text-[0.6rem] tracking-[0.3em]
                                  text-muted-foreground uppercase
                                  sm:text-xs
                                "
                              >
                                Retention
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gold/8">
                            {section.items.map((row) => (
                              <tr key={row.label} className="group">
                                <th
                                  scope="row"
                                  className="
                                    w-1/4 px-6 py-4 align-top font-medium text-foreground
                                    transition-colors
                                    group-hover:text-gold
                                  "
                                >
                                  {row.label}
                                </th>
                                <td className="px-6 py-4 text-muted-foreground">
                                  {row.detail}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
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
