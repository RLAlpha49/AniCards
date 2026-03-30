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
      <div className="h-px w-8 bg-gold/20" />
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
            className="space-y-5 motion-safe:skel-reveal motion-reduce:animate-none"
            style={{ animationDelay: "0ms" }}
          >
            <div className="skel-bone h-5 w-28" aria-hidden="true" />
            <div
              className="skel-bone h-12 w-full max-w-3xl sm:h-16"
              aria-hidden="true"
            />
            <div
              className="skel-bone h-4 w-full max-w-2xl"
              aria-hidden="true"
            />
            {/* Stat row */}
            <div className="flex gap-6 pt-2">
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="flex flex-col gap-1.5">
                  <div className="skel-bone h-7 w-16" aria-hidden="true" />
                  <div className="skel-bone h-3 w-20" aria-hidden="true" />
                </div>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div
            className="motion-safe:skel-reveal motion-reduce:animate-none"
            style={{ animationDelay: "80ms" }}
          >
            <DiamondDivider />
          </div>

          {/* Featured Project */}
          <div
            className="
              skel-card overflow-hidden p-0
              motion-safe:skel-reveal
              motion-reduce:animate-none
            "
            style={{ animationDelay: "120ms" }}
          >
            <div
              className="skel-bone-rect h-56 w-full rounded-none sm:h-72"
              aria-hidden="true"
            />
            <div className="space-y-3 p-6">
              <div className="skel-bone h-6 w-48" aria-hidden="true" />
              <div
                className="skel-bone h-3.5 w-full max-w-xl"
                aria-hidden="true"
              />
              <div className="skel-bone h-3.5 w-4/5" aria-hidden="true" />
            </div>
          </div>

          {/* Gold line divider */}
          <div
            className="gold-line w-full motion-safe:skel-reveal motion-reduce:animate-none"
            style={{ animationDelay: "180ms" }}
            aria-hidden="true"
          />

          {/* Asymmetric Project Grid */}
          <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
            {/* Big card */}
            <div
              className="skel-card space-y-4 p-6 motion-safe:skel-reveal motion-reduce:animate-none"
              style={{ animationDelay: "240ms" }}
            >
              <div className="skel-bone-rect h-44 w-full" aria-hidden="true" />
              <div className="skel-bone h-5 w-40" aria-hidden="true" />
              <div className="skel-bone h-3.5 w-full" aria-hidden="true" />
              <div className="skel-bone h-3.5 w-3/4" aria-hidden="true" />
            </div>

            {/* Stacked smaller cards */}
            <div className="flex flex-col gap-5">
              {Array.from({ length: 3 }, (_, i) => (
                <div
                  key={i}
                  className="
                    skel-card space-y-3 p-5
                    motion-safe:skel-reveal
                    motion-reduce:animate-none
                  "
                  style={{ animationDelay: `${300 + i * 60}ms` }}
                >
                  <div className="skel-bone h-4 w-32" aria-hidden="true" />
                  <div className="skel-bone h-3 w-full" aria-hidden="true" />
                  <div className="skel-bone h-3 w-5/6" aria-hidden="true" />
                </div>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div
            className="motion-safe:skel-reveal motion-reduce:animate-none"
            style={{ animationDelay: "500ms" }}
          >
            <DiamondDivider />
          </div>

          {/* Principles — 3-col */}
          <div className="grid gap-5 sm:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => (
              <div
                key={i}
                className="
                  skel-card flex flex-col items-center gap-3 p-6 text-center
                  motion-safe:skel-reveal
                  motion-reduce:animate-none
                "
                style={{ animationDelay: `${540 + i * 60}ms` }}
              >
                <div className="skel-bone-rect size-11" aria-hidden="true" />
                <div className="skel-bone h-4 w-28" aria-hidden="true" />
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

          {/* CTA */}
          <div
            className="
              flex flex-col items-center gap-4
              motion-safe:skel-reveal
              motion-reduce:animate-none
            "
            style={{ animationDelay: "720ms" }}
          >
            <div className="skel-bone h-4 w-52" aria-hidden="true" />
            <div className="skel-bone-rect h-12 w-44" aria-hidden="true" />
          </div>
        </div>
      </output>
    </div>
  );
}
