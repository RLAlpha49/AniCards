import { LoadingSpinner } from "@/components/LoadingSpinner";
import { MarketingBackdrop } from "@/components/marketing/MarketingBackdrop";

export default function Loading() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <MarketingBackdrop lightOpacity={0.35} darkOpacity={0.22} />

      <section className="relative z-10 flex min-h-screen items-center">
        <div className="container mx-auto px-4 py-24">
          <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
            <p className="mb-5 text-xs tracking-[0.6em] text-gold uppercase">
              AniCards
            </p>

            <LoadingSpinner size="lg" text="Loading AniCards..." />

            <div className="mt-10 w-full max-w-2xl space-y-4">
              <div className="mx-auto h-3 w-28 rounded-full bg-gold/15" />
              <div className="h-14 rounded-2xl border border-gold/12 bg-background/70" />

              <div className="grid gap-4 sm:grid-cols-3">
                {Array.from({ length: 3 }, (_, index) => (
                  <div
                    key={index}
                    className="h-32 rounded-2xl border border-gold/10 bg-background/55"
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
