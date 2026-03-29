import { LoadingSpinner } from "@/components/LoadingSpinner";
import { MarketingBackdrop } from "@/components/marketing/MarketingBackdrop";

export default function Loading() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <MarketingBackdrop lightOpacity={0.45} darkOpacity={0.25} />

      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `
            radial-gradient(circle at 50% 42%,
              transparent 8%,
              hsl(var(--gold) / 0.04) 8.3%, transparent 8.6%,
              transparent 16%,
              hsl(var(--gold) / 0.03) 16.3%, transparent 16.6%,
              transparent 24%,
              hsl(var(--gold) / 0.025) 24.3%, transparent 24.6%,
              transparent 32%,
              hsl(var(--gold) / 0.02) 32.3%, transparent 32.6%,
              transparent 40%,
              hsl(var(--gold) / 0.015) 40.3%, transparent 40.6%,
              transparent 48%,
              hsl(var(--gold) / 0.01) 48.3%, transparent 48.6%)
          `,
        }}
      />

      <div className="
        pointer-events-none absolute top-1/3 left-1/2 h-125 w-150 -translate-1/2 rounded-full
        bg-[hsl(var(--gold)/0.06)] blur-[140px]
      " />

      <section className="relative z-10 px-6 pt-28 pb-24 sm:px-12 md:pt-36 md:pb-32">
        <div className="mx-auto max-w-4xl text-center">
          <p className="mb-5 text-xs tracking-[0.6em] text-gold uppercase sm:text-sm">
            Profile Lookup
          </p>

          <div className="flex justify-center">
            <LoadingSpinner size="lg" text="Preparing profile search..." />
          </div>

          <div className="
            mx-auto mt-8 h-16 max-w-2xl rounded-4xl border border-gold/10 bg-background/75
          " />

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {Array.from({ length: 3 }, (_, index) => (
              <div
                key={index}
                className="h-8 rounded-full border border-gold/10 bg-background/70"
                style={{ width: `${116 + index * 26}px` }}
              />
            ))}
          </div>
        </div>

        <div className="mx-auto mt-16 max-w-5xl space-y-6">
          <div className="gold-line-thick mx-auto max-w-32" />

          <div className="grid gap-5 md:grid-cols-3">
            {Array.from({ length: 3 }, (_, index) => (
              <div
                key={index}
                className="rounded-[1.75rem] border border-gold/10 bg-background/70 p-6"
              >
                <div className="mx-auto size-10 rounded-full bg-[hsl(var(--gold)/0.14)]" />
                <div className="mx-auto mt-5 h-4 w-28 rounded-full bg-foreground/8" />
                <div className="mx-auto mt-3 h-3 w-full rounded-full bg-foreground/7" />
                <div className="mx-auto mt-2 h-3 w-4/5 rounded-full bg-foreground/6" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
