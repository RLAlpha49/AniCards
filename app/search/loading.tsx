import { MarketingBackdrop } from "@/components/marketing/MarketingBackdrop";

function DiamondDivider() {
  return (
    <div
      aria-hidden="true"
      className="flex items-center justify-center gap-3 py-1 motion-safe:skel-breathe"
    >
      <div className="h-px w-12 bg-gold/15" />
      <div className="size-1.5 rotate-45 border border-gold/25 bg-gold/5" />
      <div className="h-px w-12 bg-gold/15" />
    </div>
  );
}

export default function Loading() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <MarketingBackdrop lightOpacity={0.45} darkOpacity={0.25} />

      {/* Central gold glow */}
      <div
        aria-hidden="true"
        className="
          pointer-events-none absolute top-1/3 left-1/2 h-125 w-150 -translate-1/2
          bg-[hsl(var(--gold)/0.06)] blur-[140px]
        "
      />

      <output aria-live="polite" aria-busy="true" className="block">
        {/* -- Hero skeleton -- */}
        <section className="relative z-10 px-6 pt-28 pb-24 sm:px-12 md:pt-36 md:pb-32">
          <div className="mx-auto max-w-4xl text-center">
            {/* "Profile Lookup" label bone */}
            <div
              className="mx-auto mb-5 motion-safe:skel-reveal motion-reduce:animate-none"
              style={{ animationDelay: "0ms" }}
            >
              <div className="skel-bone mx-auto h-3 w-36 sm:h-3.5 sm:w-44" />
            </div>

            {/* Large title bones (two lines) */}
            <div
              className="space-y-3 motion-safe:skel-reveal motion-reduce:animate-none"
              style={{ animationDelay: "80ms" }}
            >
              <div className="skel-bone mx-auto h-9 w-72 sm:h-11 sm:w-96" />
              <div className="skel-bone mx-auto h-9 w-48 sm:h-11 sm:w-64" />
            </div>

            {/* Diamond divider ornament */}
            <div
              className="my-8 motion-safe:skel-reveal motion-reduce:animate-none"
              style={{ animationDelay: "140ms" }}
            >
              <DiamondDivider />
            </div>

            {/* Search bar bone - sharp corners */}
            <div
              className="motion-safe:skel-reveal motion-reduce:animate-none"
              style={{ animationDelay: "200ms" }}
            >
              <div className="
                skel-bone-rect mx-auto flex h-14 max-w-2xl items-center gap-3 px-6
                sm:h-16
              ">
                {/* Search icon placeholder */}
                <div className="size-5 shrink-0 bg-[hsl(var(--gold)/0.12)]" />
                <div className="skel-bone h-3.5 flex-1" />
              </div>
            </div>

            {/* Toggle pill bones (username / ID / etc.) */}
            <div
              className="
                mt-6 flex flex-wrap justify-center gap-3
                motion-safe:skel-reveal
                motion-reduce:animate-none
              "
              style={{ animationDelay: "280ms" }}
            >
              {[96, 80, 108].map((w) => (
                <div
                  key={w}
                  className="skel-bone h-8"
                  style={{ width: `${String(w)}px` }}
                />
              ))}
            </div>
          </div>
        </section>

        {/* -- Divider -- */}
        <div
          className="motion-safe:skel-reveal motion-reduce:animate-none"
          style={{ animationDelay: "340ms" }}
        >
          <div className="gold-line-thick mx-auto max-w-[60%]" />
        </div>

        {/* -- Journey / 3-step process -- */}
        <section className="px-6 py-20 sm:px-12 md:py-28">
          {/* Section header bones */}
          <div
            className="mb-16 text-center motion-safe:skel-reveal motion-reduce:animate-none"
            style={{ animationDelay: "400ms" }}
          >
            <div className="skel-bone mx-auto mb-4 h-3 w-28" />
            <div className="skel-bone mx-auto mb-4 h-8 w-44 sm:h-10 sm:w-56" />
            <div className="gold-line-thick mx-auto max-w-20" />
          </div>

          {/* 3 step cards */}
          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-14 md:grid-cols-3 md:gap-8">
            {["look-up", "build", "refine"].map((step, i) => (
              <div
                key={step}
                className="
                  flex flex-col items-center text-center
                  motion-safe:skel-reveal
                  motion-reduce:animate-none
                "
                style={{ animationDelay: `${String(460 + i * 80)}ms` }}
              >
                {/* Numbered circle */}
                <div className="
                  mb-6 flex size-14 items-center justify-center border border-gold/15 bg-gold/5
                ">
                  <div className="skel-bone h-4 w-6" />
                </div>
                {/* Title bone */}
                <div className="skel-bone mb-3 h-4 w-24" />
                {/* Description bones */}
                <div className="skel-bone mb-2 h-3 w-full max-w-52" />
                <div className="skel-bone h-3 w-4/5 max-w-44" />
              </div>
            ))}
          </div>
        </section>

        {/* -- Divider -- */}
        <div
          className="motion-safe:skel-reveal motion-reduce:animate-none"
          style={{ animationDelay: "700ms" }}
        >
          <div className="gold-line mx-auto max-w-[40%]" />
        </div>

        {/* -- Capabilities / 3 feature cards -- */}
        <section className="px-6 py-20 sm:px-12 md:py-28">
          {/* Section header bones */}
          <div
            className="mb-16 text-center motion-safe:skel-reveal motion-reduce:animate-none"
            style={{ animationDelay: "760ms" }}
          >
            <div className="skel-bone mx-auto mb-4 h-3 w-24" />
            <div className="skel-bone mx-auto mb-4 h-8 w-56 sm:h-10 sm:w-72" />
            <div className="gold-line-thick mx-auto max-w-20" />
          </div>

          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 md:grid-cols-3 md:gap-6">
            {["card-types", "customization", "sharing"].map((cap, i) => (
              <div
                key={cap}
                className="
                  skel-card p-8 text-center
                  motion-safe:skel-reveal
                  motion-reduce:animate-none
                "
                style={{ animationDelay: `${String(820 + i * 80)}ms` }}
              >
                {/* Icon placeholder */}
                <div className="mx-auto mb-6 size-12 bg-[hsl(var(--gold)/0.08)]" />
                {/* Title bone */}
                <div className="skel-bone mx-auto mb-4 h-4 w-36" />
                {/* Description bones */}
                <div className="skel-bone mx-auto mb-2 h-3 w-full" />
                <div className="skel-bone mx-auto mb-2 h-3 w-5/6" />
                <div className="skel-bone mx-auto h-3 w-3/4" />
              </div>
            ))}
          </div>
        </section>

        {/* -- CTA -- */}
        <section
          className="
            border-y-2 border-gold/20 px-6 py-20 text-center
            motion-safe:skel-reveal
            motion-reduce:animate-none
            sm:px-12
            md:py-24
          "
          style={{ animationDelay: "1060ms" }}
        >
          <div className="mx-auto max-w-2xl">
            <div className="skel-bone mx-auto mb-8 h-5 w-10" />
            <div className="skel-bone mx-auto mb-3 h-9 w-64 sm:h-11 sm:w-80" />
            <div className="skel-bone mx-auto mb-10 h-3.5 w-36" />
            <div className="skel-bone mx-auto h-12 w-44" />
          </div>
        </section>
      </output>
    </div>
  );
}
