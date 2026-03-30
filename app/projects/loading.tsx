import { LoadingSpinner } from "@/components/LoadingSpinner";
import { MarketingBackdrop } from "@/components/marketing/MarketingBackdrop";

export default function Loading() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <MarketingBackdrop lightOpacity={0.35} darkOpacity={0.22} />

      <section className="relative z-10 px-6 py-16 sm:px-10 lg:px-12 lg:py-20">
        <div className="mx-auto max-w-6xl space-y-10">
          <div className="space-y-4">
            <div className="h-6 w-32 rounded-full bg-gold/12" />
            <div className="h-14 w-full max-w-3xl rounded-full bg-foreground/7" />
            <div className="h-4 w-full max-w-2xl rounded-full bg-foreground/8" />
          </div>

          <div className="flex justify-center">
            <LoadingSpinner size="md" text="Gathering project highlights..." />
          </div>

          <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-[1.75rem] border border-gold/10 bg-background/80 p-6">
              <div className="h-64 rounded-2xl bg-foreground/6" />
              <div className="mt-5 h-5 w-40 rounded-full bg-foreground/8" />
              <div className="mt-3 h-4 w-full rounded-full bg-foreground/7" />
              <div className="mt-2 h-4 w-4/5 rounded-full bg-foreground/7" />
            </div>

            <div className="space-y-5">
              {Array.from({ length: 3 }, (_, index) => (
                <div
                  key={index}
                  className="rounded-2xl border border-gold/10 bg-background/80 p-5"
                >
                  <div className="h-4 w-32 rounded-full bg-foreground/8" />
                  <div className="mt-3 h-3 w-full rounded-full bg-foreground/7" />
                  <div className="mt-2 h-3 w-5/6 rounded-full bg-foreground/7" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
