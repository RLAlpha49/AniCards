import { LoadingSpinner } from "@/components/LoadingSpinner";
import { MarketingBackdrop } from "@/components/marketing/MarketingBackdrop";

export default function Loading() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <MarketingBackdrop lightOpacity={0.35} darkOpacity={0.22} />

      <section className="relative z-10 px-6 py-16 sm:px-10 lg:px-12 lg:py-20">
        <div className="mx-auto flex max-w-6xl flex-col gap-10">
          <div className="max-w-3xl space-y-5">
            <div className="h-6 w-40 rounded-full bg-gold/12" />
            <div className="space-y-4">
              <div className="h-12 w-full max-w-md rounded-full bg-foreground/7 sm:h-14" />
              <div className="h-4 w-full max-w-2xl rounded-full bg-foreground/8" />
              <div className="h-4 w-4/5 rounded-full bg-foreground/8" />
            </div>
          </div>

          <div className="flex justify-center">
            <LoadingSpinner size="md" text="Preparing contact options..." />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {Array.from({ length: 2 }, (_, index) => (
              <div
                key={index}
                className="rounded-2xl border border-gold/10 bg-background/80 p-5"
              >
                <div className="h-5 w-36 rounded-full bg-foreground/8" />
                <div className="mt-3 h-4 w-full rounded-full bg-foreground/7" />
                <div className="mt-2 h-4 w-4/5 rounded-full bg-foreground/7" />
                <div className="mt-4 h-20 rounded-2xl bg-background/70" />
              </div>
            ))}
          </div>

          <div className="rounded-3xl border border-dashed border-gold/20 bg-gold/6 p-6">
            <div className="h-5 w-44 rounded-full bg-foreground/8" />
            <div className="mt-3 h-4 w-full rounded-full bg-foreground/7" />
            <div className="mt-2 h-4 w-3/4 rounded-full bg-foreground/7" />
          </div>
        </div>
      </section>
    </div>
  );
}
