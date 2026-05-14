import { MarketingBackdrop } from "@/components/marketing/MarketingBackdrop";

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
      <div className="h-px w-12 bg-gold/20" />
      <div className="size-1.5 rotate-45 border border-gold/25 bg-gold/5" />
      <div className="h-px w-8 bg-gold/15" />
      <div className="size-1.5 rotate-45 border border-gold/25 bg-gold/5" />
      <div className="h-px w-12 bg-gold/20" />
    </div>
  );
}

export default function Loading() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <MarketingBackdrop lightOpacity={0.35} darkOpacity={0.22} />

      <output
        aria-live="polite"
        aria-busy="true"
        className="relative z-10 block px-6 py-16 sm:px-10 lg:px-12 lg:py-20"
      >
        <div className="mx-auto flex max-w-6xl flex-col gap-12">
          {/* Hero */}
          <div
            className="max-w-3xl space-y-5 motion-safe:skel-reveal motion-reduce:animate-none"
            data-skel-delay="0"
          >
            <div className="skel-bone h-5 w-32" aria-hidden="true" />
            <div className="space-y-3">
              <div
                className="skel-bone h-11 w-full max-w-lg sm:h-14"
                aria-hidden="true"
              />
              <div
                className="skel-bone h-11 w-4/5 max-w-md sm:h-14"
                aria-hidden="true"
              />
            </div>
            <div
              className="skel-bone h-4 w-full max-w-2xl"
              aria-hidden="true"
            />
          </div>

          {/* Divider */}
          <div
            className="gold-line w-full motion-safe:skel-reveal motion-reduce:animate-none"
            data-skel-delay="80"
            aria-hidden="true"
          />

          {/* Diamond divider */}
          <div
            className="motion-safe:skel-reveal motion-reduce:animate-none"
            data-skel-delay="120"
          >
            <DiamondDivider />
          </div>

          {/* Channel Cards — 4-col grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div
                key={i}
                className="
                  skel-card flex flex-col items-center gap-3 p-6 text-center
                  motion-safe:skel-reveal
                  motion-reduce:animate-none
                "
                data-skel-delay={String(160 + i * 60)}
              >
                <div className="skel-bone-rect size-10" aria-hidden="true" />
                <div className="skel-bone h-4 w-24" aria-hidden="true" />
                <div className="w-full space-y-2">
                  <div
                    className="skel-bone mx-auto h-3 w-5/6"
                    aria-hidden="true"
                  />
                  <div
                    className="skel-bone mx-auto h-3 w-3/4"
                    aria-hidden="true"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Reasons — 2-col grid */}
          <div className="grid gap-5 sm:grid-cols-2">
            {Array.from({ length: 4 }, (_, i) => (
              <div
                key={i}
                className="
                  skel-card space-y-3 p-5
                  motion-safe:skel-reveal
                  motion-reduce:animate-none
                "
                data-skel-delay={String(420 + i * 60)}
              >
                <div className="skel-bone h-5 w-36" aria-hidden="true" />
                <div className="skel-bone h-3 w-full" aria-hidden="true" />
                <div className="skel-bone h-3 w-4/5" aria-hidden="true" />
              </div>
            ))}
          </div>

          {/* CTA */}
          <div
            className="
              flex flex-col items-center gap-4
              motion-safe:skel-reveal
              motion-reduce:animate-none
            "
            data-skel-delay="680"
          >
            <div className="skel-bone h-4 w-48" aria-hidden="true" />
            <div className="skel-bone-rect h-12 w-44" aria-hidden="true" />
          </div>
        </div>
      </output>
    </div>
  );
}
