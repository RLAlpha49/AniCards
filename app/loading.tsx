import { MarketingBackdrop } from "@/components/marketing/MarketingBackdrop";

function DiamondDivider({ className }: Readonly<{ className?: string }>) {
  return (
    <div
      className={`flex items-center gap-3 ${className ?? ""}`}
      aria-hidden="true"
    >
      <div className="h-px flex-1 bg-linear-to-r from-transparent to-gold/20" />
      <div className="
        size-1.5 rotate-45 border border-gold/25 bg-gold/5
        motion-safe:skel-breathe
        motion-reduce:animate-none
      " />
      <div className="h-px flex-1 bg-linear-to-l from-transparent to-gold/20" />
    </div>
  );
}

export default function Loading() {
  return (
    <section
      aria-busy="true"
      aria-labelledby="home-loading-status"
      className="relative min-h-screen overflow-hidden"
    >
      <p
        id="home-loading-status"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        Loading home page
      </p>
      <MarketingBackdrop lightOpacity={0.35} darkOpacity={0.22} />

      {/* Hero Section */}
      <section className="
        relative z-10 flex min-h-[70vh] items-center justify-center px-4 pt-28 pb-16
      ">
        <div className="flex w-full max-w-3xl flex-col items-center text-center">
          {/* Label */}
          <div
            className="
              mb-6 flex items-center gap-2
              motion-safe:skel-reveal
              motion-reduce:animate-none
            "
            style={{ animationDelay: "0ms" }}
            aria-hidden="true"
          >
            <div className="h-px w-8 bg-gold/20" />
            <div className="skel-bone h-2.5 w-20" />
            <div className="h-px w-8 bg-gold/20" />
          </div>

          {/* Title */}
          <div
            className="
              skel-bone mb-3 h-11 w-80 max-w-full
              motion-safe:skel-reveal
              motion-reduce:animate-none
              sm:h-14 sm:w-104
            "
            style={{ animationDelay: "80ms" }}
            aria-hidden="true"
          />

          {/* Subtitle line 1 */}
          <div
            className="
              skel-bone mb-2 h-4 w-72 max-w-full
              motion-safe:skel-reveal
              motion-reduce:animate-none
              sm:w-96
            "
            style={{ animationDelay: "160ms" }}
            aria-hidden="true"
          />

          {/* Subtitle line 2 */}
          <div
            className="
              skel-bone mb-10 h-4 w-52 max-w-full
              motion-safe:skel-reveal
              motion-reduce:animate-none
              sm:w-72
            "
            style={{ animationDelay: "220ms" }}
            aria-hidden="true"
          />

          {/* CTA button */}
          <div
            className="skel-bone-rect h-12 w-44 motion-safe:skel-reveal motion-reduce:animate-none"
            style={{ animationDelay: "300ms" }}
            aria-hidden="true"
          />
        </div>
      </section>

      {/* Divider */}
      <div
        className="
          relative z-10 mx-auto max-w-xs px-6 py-4
          motion-safe:skel-reveal
          motion-reduce:animate-none
        "
        style={{ animationDelay: "380ms" }}
      >
        <DiamondDivider />
      </div>

      {/* Card Marquee Strip */}
      <section
        className="relative z-10 overflow-hidden px-4 py-8"
        aria-hidden="true"
      >
        <div
          className="
            mx-auto flex max-w-6xl gap-4 overflow-hidden
            motion-safe:skel-reveal
            motion-reduce:animate-none
          "
          style={{ animationDelay: "440ms" }}
        >
          {Array.from({ length: 4 }, (_, i) => (
            <div
              key={i}
              className="skel-card h-44 w-64 shrink-0 sm:h-48 sm:w-72"
            />
          ))}
        </div>
      </section>

      {/* Divider */}
      <div
        className="
          relative z-10 mx-auto max-w-2xs p-6
          motion-safe:skel-reveal
          motion-reduce:animate-none
        "
        style={{ animationDelay: "520ms" }}
      >
        <DiamondDivider />
      </div>

      {/* Bento Features Grid */}
      <section className="relative z-10 px-4 py-10" aria-hidden="true">
        <div className="mx-auto grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={i}
              className="
                skel-card flex flex-col gap-4 p-6
                motion-safe:skel-reveal
                motion-reduce:animate-none
              "
              style={{ animationDelay: `${600 + i * 80}ms` }}
            >
              <div className="skel-bone-rect size-10" />
              <div className="skel-bone h-3.5 w-28" />
              <div className="space-y-2">
                <div className="skel-bone h-2.5 w-full" />
                <div className="skel-bone h-2.5 w-4/5" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Stats Ribbon */}
      <section
        className="relative z-10 px-4 py-10 motion-safe:skel-reveal motion-reduce:animate-none"
        style={{ animationDelay: "1100ms" }}
        aria-hidden="true"
      >
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-10">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <div className="skel-bone h-8 w-16" />
              <div className="h-px w-10 bg-gold/10" />
              <div className="skel-bone h-2.5 w-14" />
            </div>
          ))}
        </div>
      </section>

      {/* Process Steps */}
      <section className="relative z-10 px-4 py-10" aria-hidden="true">
        <div
          className="
            skel-bone mx-auto mb-8 h-5 w-44
            motion-safe:skel-reveal
            motion-reduce:animate-none
          "
          style={{ animationDelay: "1200ms" }}
        />
        <div className="mx-auto grid max-w-4xl gap-6 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div
              key={i}
              className="
                flex flex-col items-center gap-3 text-center
                motion-safe:skel-reveal
                motion-reduce:animate-none
              "
              style={{ animationDelay: `${1280 + i * 100}ms` }}
            >
              <div className="
                flex size-12 items-center justify-center border border-gold/15 bg-gold/4
              ">
                <div className="skel-bone h-4 w-5" />
              </div>
              <div className="skel-bone h-3.5 w-24" />
              <div className="skel-bone h-2.5 w-36" />
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section
        className="
          relative z-10 flex flex-col items-center gap-4 px-4 py-16
          motion-safe:skel-reveal
          motion-reduce:animate-none
        "
        style={{ animationDelay: "1600ms" }}
        aria-hidden="true"
      >
        <div className="skel-bone h-6 w-60 max-w-full sm:w-72" />
        <div className="skel-bone h-3.5 w-44" />
        <div className="skel-bone-rect mt-2 h-12 w-40" />
      </section>
    </section>
  );
}
