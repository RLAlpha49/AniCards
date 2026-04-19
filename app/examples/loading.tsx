import { MarketingBackdrop } from "@/components/marketing/MarketingBackdrop";

const EXAMPLES_LOADING_FILTER_PILL_WIDTH_CLASSES = [
  "w-20",
  "w-24",
  "w-28",
  "w-32",
  "w-36",
] as const;
const EXAMPLES_LOADING_GALLERY_DELAYS = [
  "500",
  "590",
  "680",
  "770",
  "860",
  "950",
] as const;

function DiamondDivider() {
  return (
    <div
      className="
        flex items-center justify-center gap-3
        motion-safe:skel-breathe
        motion-reduce:animate-none
      "
      aria-hidden="true"
    >
      <div className="
        h-px max-w-24 flex-1 bg-linear-to-r from-transparent to-[hsl(var(--gold)/0.3)]
      " />
      <div className="size-1.5 rotate-45 border border-gold/25 bg-gold/5" />
      <div className="h-px max-w-32 flex-1 bg-[hsl(var(--gold)/0.25)]" />
      <div className="size-1.5 rotate-45 border border-gold/25 bg-gold/5" />
      <div className="
        h-px max-w-24 flex-1 bg-linear-to-l from-transparent to-[hsl(var(--gold)/0.3)]
      " />
    </div>
  );
}

export default function Loading() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <MarketingBackdrop lightOpacity={0.45} darkOpacity={0.25} />

      <output
        aria-live="polite"
        aria-busy="true"
        aria-label="Loading examples page"
        className="relative z-10 block"
      >
        {/* ── Hero Section ── */}
        <section className="px-6 pt-28 pb-16 sm:px-12 md:pt-36 md:pb-24">
          <div className="mx-auto max-w-7xl">
            {/* Showcase label */}
            <div
              className="
                mb-8 flex items-center justify-start gap-4
                motion-safe:skel-reveal
                motion-reduce:animate-none
              "
              data-skel-delay="0"
            >
              <div
                className="
                  h-px max-w-12 flex-1 bg-linear-to-r from-transparent to-[hsl(var(--gold)/0.5)]
                "
                aria-hidden="true"
              />
              <div className="skel-bone h-3 w-16" aria-hidden="true" />
              <div
                className="
                  h-px max-w-12 flex-1 bg-linear-to-l from-transparent to-[hsl(var(--gold)/0.5)]
                "
                aria-hidden="true"
              />
            </div>

            <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
              {/* Title + Subtitle + Description */}
              <div className="w-full max-w-3xl space-y-4">
                <div
                  className="
                    skel-bone h-12 w-72 max-w-full
                    motion-safe:skel-reveal
                    motion-reduce:animate-none
                    sm:h-14 sm:w-96
                  "
                  data-skel-delay="80"
                  aria-hidden="true"
                />
                <div
                  className="
                    skel-bone h-5 w-80 max-w-full
                    motion-safe:skel-reveal
                    motion-reduce:animate-none
                    sm:w-md
                  "
                  data-skel-delay="160"
                  aria-hidden="true"
                />
                <div
                  className="
                    skel-bone h-4 w-64 max-w-full
                    motion-safe:skel-reveal
                    motion-reduce:animate-none
                    sm:w-96
                  "
                  data-skel-delay="220"
                  aria-hidden="true"
                />
              </div>

              {/* Stat pills */}
              <div
                className="
                  flex flex-wrap items-center justify-center gap-3
                  motion-safe:skel-reveal
                  motion-reduce:animate-none
                  lg:min-w-60 lg:justify-end
                "
                data-skel-delay="280"
                aria-hidden="true"
              >
                {Array.from({ length: 3 }, (_, i) => (
                  <div key={i} className="flex flex-col items-center gap-1.5">
                    <div className="skel-bone h-7 w-14" />
                    <div className="skel-bone h-2.5 w-12" />
                  </div>
                ))}
              </div>
            </div>

            {/* Art-deco diamond divider */}
            <div
              className="py-6 motion-safe:skel-reveal motion-reduce:animate-none"
              data-skel-delay="340"
            >
              <DiamondDivider />
            </div>

            {/* Filter Bar */}
            <div
              className="skel-card p-5 motion-safe:skel-reveal motion-reduce:animate-none"
              data-skel-delay="400"
              aria-hidden="true"
            >
              {/* Search input */}
              <div className="skel-bone-rect h-11 w-full" />

              {/* Category tab pills */}
              <div className="mt-4 flex flex-wrap gap-3">
                {Array.from({ length: 5 }, (_, i) => (
                  <div
                    key={i}
                    className={`skel-bone h-8 ${EXAMPLES_LOADING_FILTER_PILL_WIDTH_CLASSES[i]}`}
                  />
                ))}
              </div>
            </div>

            {/* Gallery Grid */}
            <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }, (_, i) => (
                <div
                  key={i}
                  className="
                    skel-card flex flex-col gap-4 p-5
                    motion-safe:skel-reveal
                    motion-reduce:animate-none
                  "
                  data-skel-delay={EXAMPLES_LOADING_GALLERY_DELAYS[i]}
                  aria-hidden="true"
                >
                  {/* Image placeholder */}
                  <div className="skel-bone-rect h-44" />
                  {/* Title */}
                  <div className="skel-bone h-4 w-36" />
                  {/* Description lines */}
                  <div className="space-y-2">
                    <div className="skel-bone h-3 w-full" />
                    <div className="skel-bone h-3 w-4/5" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </output>
    </div>
  );
}
