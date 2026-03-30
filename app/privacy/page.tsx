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

const disclosureItems = [
  {
    title: "What the app stores",
    body: "AniCards can persist minimized AniList-derived user snapshots, saved card settings, and an on-device Google Analytics consent choice. Google Analytics stays off unless you opt in.",
  },
  {
    title: "What telemetry looks like",
    body: "Google Analytics events only run after consent and stay limited to normalized route patterns and bounded labels rather than raw browsing history. Separate Vercel runtime telemetry can still collect privacy-safe performance signals when enabled for the deployment.",
  },
  {
    title: "Retention limits that matter",
    body: "Analytics counters are stored in monthly buckets with a roughly 400-day TTL, server lifecycle audit logs are capped at 250 entries, and failed update counters expire after 14 days.",
  },
  {
    title: "What gets ignored",
    body: "Client error reports ignore userId and username fields before persistence, so those client-supplied identifiers are not stored with structured error reports.",
  },
] as const;

const retentionItems = [
  "Saved user snapshots and card settings do not currently have a blanket TTL; they remain until overwritten, manually deleted, or removed by the stale-user cleanup flow.",
  "Analytics counters are rotated into monthly buckets with a roughly 400-day TTL, which keeps raw counter retention to about 13 months.",
  "Structured error reports are stored in a bounded list capped at 250 entries.",
  "Server lifecycle audit logs are capped at 250 entries.",
  "Failed update counters expire after 14 days, and three consecutive scheduled AniList 404s inside that window trigger cleanup of the stored user.",
] as const;

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

      <main className="relative isolate overflow-hidden">
        <MarketingBackdrop lightOpacity={0.35} darkOpacity={0.22} />

        <div className="
          relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-16
          sm:px-10
          lg:px-12 lg:py-20
        ">
          <SectionReveal>
            <section className="max-w-3xl space-y-5">
              <span className="
                inline-flex items-center rounded-full border border-gold/25 bg-gold/8 px-3 py-1
                text-xs font-semibold tracking-[0.2em] text-gold uppercase
              ">
                Privacy disclosure
              </span>

              <div className="space-y-4">
                <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
                  Privacy summary
                </h1>
                <p className="max-w-2xl text-base/7 text-muted-foreground sm:text-lg">
                  This page is a public product disclosure about the data flows
                  in AniCards. It is not a legal privacy policy or a contractual
                  promise.
                </p>
              </div>
            </section>
          </SectionReveal>

          <SectionReveal>
            <section aria-labelledby="privacy-highlights" className="space-y-5">
              <div className="space-y-2">
                <h2
                  id="privacy-highlights"
                  className="text-2xl font-semibold tracking-tight text-foreground"
                >
                  Current highlights
                </h2>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                {disclosureItems.map((item) => (
                  <article
                    key={item.title}
                    className="
                      rounded-2xl border border-gold/15 bg-background/80 p-5 shadow-sm
                      backdrop-blur-sm
                    "
                  >
                    <h3 className="text-lg font-semibold text-foreground">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-sm/7 text-muted-foreground sm:text-base">
                      {item.body}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          </SectionReveal>

          <SectionReveal>
            <section
              aria-labelledby="privacy-retention"
              className="
                rounded-3xl border border-gold/15 bg-background/85 p-6 shadow-sm backdrop-blur-sm
                sm:p-8
              "
            >
              <div className="max-w-3xl space-y-3">
                <h2
                  id="privacy-retention"
                  className="text-2xl font-semibold tracking-tight text-foreground"
                >
                  Retention and deletion snapshot
                </h2>
                <p className="text-sm/7 text-muted-foreground sm:text-base">
                  The current retention posture is intentionally bounded where
                  possible and documented in more technical detail in{" "}
                  <Link
                    href="https://github.com/RLAlpha49/AniCards/blob/main/docs/PRIVACY.md"
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-gold hover:text-gold/80"
                  >
                    docs/PRIVACY.md
                  </Link>
                  .
                </p>
              </div>

              <ul className="mt-5 space-y-3 text-sm/7 text-muted-foreground sm:text-base">
                {retentionItems.map((item) => (
                  <li key={item} className="flex gap-3">
                    <span className="mt-2 size-2 shrink-0 rounded-full bg-gold/70" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          </SectionReveal>

          <SectionReveal>
            <section
              aria-labelledby="privacy-contact"
              className="max-w-3xl rounded-2xl border border-dashed border-gold/25 bg-gold/6 p-6"
            >
              <h2
                id="privacy-contact"
                className="text-2xl font-semibold tracking-tight text-foreground"
              >
                Need deletion or export help?
              </h2>
              <p className="mt-3 text-sm/7 text-muted-foreground sm:text-base">
                There is no public self-serve export or deletion flow yet. For
                manual requests, contact{" "}
                <Link
                  href="mailto:contact@alpha49.com"
                  className="font-medium text-gold hover:text-gold/80"
                >
                  contact@alpha49.com
                </Link>
                .
              </p>
            </section>
          </SectionReveal>
        </div>
      </main>
    </>
  );
}
