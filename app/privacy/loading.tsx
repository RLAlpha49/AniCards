import { MarketingBackdrop } from "@/components/marketing/MarketingBackdrop";

export default function Loading() {
  return (
    <div className="relative isolate overflow-hidden">
      <MarketingBackdrop lightOpacity={0.25} darkOpacity={0.15} />

      <output aria-live="polite" aria-busy="true" className="block">
        {/* ── Hero skeleton ── */}
        <section className="relative overflow-hidden px-6 pt-28 pb-20 sm:px-12 md:pt-40 md:pb-28">
          <div className="relative z-10 mx-auto max-w-6xl">
            {/* Decorative top frame */}
            <div
              className="
                mb-14 flex items-center gap-4
                motion-safe:skel-reveal
                motion-reduce:animate-none
              "
              style={{ animationDelay: "0ms" }}
            >
              <div className="h-px flex-1 bg-gold/10" />
              <div className="flex items-center gap-3">
                <div className="size-1.5 rotate-45 border border-gold/25 bg-gold/5" />
                <div className="skel-bone h-2.5 w-28" />
                <div className="size-1.5 rotate-45 border border-gold/25 bg-gold/5" />
              </div>
              <div className="h-px flex-1 bg-gold/10" />
            </div>

            {/* Oversized stacked heading bones (YOUR / DATA) */}
            <div
              className="
                flex flex-col items-center space-y-3
                motion-safe:skel-reveal
                motion-reduce:animate-none
              "
              style={{ animationDelay: "80ms" }}
            >
              <div className="skel-bone-rect h-20 w-48 sm:h-28 sm:w-72 md:h-32 md:w-80" />
              <div className="skel-bone-rect h-20 w-40 sm:h-28 sm:w-60 md:h-32 md:w-72" />
            </div>

            {/* Gold separator */}
            <div
              className="
                mx-auto my-10 flex items-center gap-3
                motion-safe:skel-reveal
                motion-reduce:animate-none
              "
              style={{ animationDelay: "160ms" }}
            >
              <div className="h-0.5 w-8 bg-gold/10" />
              <div className="size-1.5 rotate-45 border border-gold/25 bg-gold/5" />
              <div className="h-0.5 w-8 bg-gold/10" />
            </div>

            {/* Subtitle bones */}
            <div
              className="
                mx-auto max-w-xl space-y-2 text-center
                motion-safe:skel-reveal
                motion-reduce:animate-none
              "
              style={{ animationDelay: "220ms" }}
            >
              <div className="skel-bone mx-auto h-4 w-full max-w-md" />
              <div className="skel-bone mx-auto h-4 w-4/5 max-w-sm" />
            </div>
          </div>
        </section>

        {/* ── Divider ── */}
        <div
          className="motion-safe:skel-reveal motion-reduce:animate-none"
          style={{ animationDelay: "280ms" }}
        >
          <div className="mx-auto flex max-w-[min(90%,72rem)] items-center gap-3">
            <div className="h-px flex-1 bg-linear-to-r from-transparent to-gold/20" />
            <div className="size-1.5 rotate-45 border border-gold/25 bg-gold/5" />
            <div className="h-px flex-1 bg-linear-to-l from-transparent to-gold/20" />
          </div>
        </div>

        {/* ── Content grid: TOC + sections ── */}
        <div className="
          relative z-10 mx-auto grid w-full max-w-6xl gap-x-20 gap-y-12 px-6 py-16
          sm:px-12
          lg:grid-cols-[13rem_1fr] lg:py-24
        ">
          {/* TOC skeleton (desktop only) */}
          <div
            className="hidden motion-safe:skel-reveal motion-reduce:animate-none lg:block"
            style={{ animationDelay: "340ms" }}
          >
            <div className="skel-bone mb-5 h-2.5 w-16" />
            <div className="space-y-4 border-l-2 border-gold/10 pl-5">
              {[65, 72, 80, 60].map((w) => (
                <div key={w} className="flex items-baseline gap-3">
                  <div className="skel-bone h-2 w-5" />
                  <div className="skel-bone h-3.5" style={{ width: `${w}%` }} />
                </div>
              ))}
            </div>
          </div>

          {/* Sections column */}
          <div className="space-y-24 lg:space-y-28">
            {["collection", "telemetry", "retention", "deletion"].map(
              (id, i) => (
                <div
                  key={id}
                  className="space-y-6 motion-safe:skel-reveal motion-reduce:animate-none"
                  style={{ animationDelay: `${400 + i * 100}ms` }}
                >
                  {/* Ordinal + heading group */}
                  <div className="flex items-start gap-6">
                    <div className="relative shrink-0 pt-1">
                      <div className="absolute top-0 left-0 h-full w-0.5 bg-gold/10" />
                      <div className="skel-bone-rect ml-4 h-12 w-14 sm:h-16" />
                    </div>
                    <div className="space-y-2 pt-2">
                      <div className="skel-bone h-6 w-44 sm:h-7 sm:w-52" />
                      <div className="skel-bone h-3.5 w-64" />
                    </div>
                  </div>

                  {/* Diamond-accented rule */}
                  <div className="flex items-center gap-2">
                    <div className="h-px flex-1 bg-gold/8" />
                    <div className="size-1 rotate-45 border border-gold/25 bg-gold/5" />
                    <div className="h-px flex-1 bg-gold/8" />
                  </div>

                  {/* Body: paragraphs for 0,1,3 — table for 2 */}
                  {id === "retention" ? (
                    <div className="
                      overflow-hidden border border-gold/12 bg-background/60 backdrop-blur-sm
                    ">
                      {/* Table header */}
                      <div className="flex gap-4 border-b border-gold/10 bg-gold/4 px-6 py-3.5">
                        <div className="skel-bone h-2.5 w-20" />
                        <div className="skel-bone h-2.5 w-20" />
                      </div>
                      {/* Table rows */}
                      {["user", "analytics", "errors", "audit", "failures"].map(
                        (row) => (
                          <div
                            key={row}
                            className="flex gap-4 border-b border-gold/6 px-6 py-4 last:border-b-0"
                          >
                            <div className="skel-bone h-3.5 w-1/4" />
                            <div className="skel-bone h-3.5 w-3/4" />
                          </div>
                        ),
                      )}
                    </div>
                  ) : (
                    <div className="max-w-2xl space-y-4 pt-1">
                      <div className="skel-bone h-4 w-full" />
                      <div className="skel-bone h-4 w-11/12" />
                      <div className="skel-bone h-4 w-5/6" />
                    </div>
                  )}
                </div>
              ),
            )}
          </div>
        </div>

        {/* ── CTA band skeleton ── */}
        <div
          className="
            relative z-10 mx-auto mb-20 max-w-6xl px-6
            motion-safe:skel-reveal
            motion-reduce:animate-none
            sm:px-12
          "
          style={{ animationDelay: "900ms" }}
        >
          <div className="skel-card imperial-card p-8 sm:p-10">
            <div className="flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-2">
                <div className="skel-bone h-5 w-56" />
                <div className="skel-bone h-4 w-72" />
              </div>
              <div className="skel-bone-rect h-12 w-40" />
            </div>
          </div>
        </div>
      </output>
    </div>
  );
}
