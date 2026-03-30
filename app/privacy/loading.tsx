import { LoadingSpinner } from "@/components/LoadingSpinner";
import { MarketingBackdrop } from "@/components/marketing/MarketingBackdrop";

export default function Loading() {
  return (
    <main className="relative isolate overflow-hidden">
      <MarketingBackdrop lightOpacity={0.35} darkOpacity={0.22} />

      <div className="
        relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-16
        sm:px-10
        lg:px-12 lg:py-20
      ">
        <section className="max-w-3xl space-y-5">
          <div className="h-6 w-44 rounded-full bg-gold/12" />
          <div className="space-y-4">
            <div className="h-12 w-full max-w-md rounded-full bg-foreground/7 sm:h-14" />
            <div className="h-4 w-full max-w-2xl rounded-full bg-foreground/8" />
            <div className="h-4 w-5/6 rounded-full bg-foreground/8" />
          </div>
        </section>

        <div className="flex justify-center">
          <LoadingSpinner size="md" text="Checking privacy details..." />
        </div>

        <section className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }, (_, index) => (
            <article
              key={index}
              className="
                rounded-2xl border border-gold/15 bg-background/80 p-5 shadow-sm backdrop-blur-sm
              "
            >
              <div className="h-5 w-40 rounded-full bg-foreground/8" />
              <div className="mt-3 h-4 w-full rounded-full bg-foreground/7" />
              <div className="mt-2 h-4 w-4/5 rounded-full bg-foreground/7" />
              <div className="mt-5 h-3 w-1/2 rounded-full bg-foreground/6" />
            </article>
          ))}
        </section>

        <section className="
          rounded-3xl border border-gold/15 bg-background/85 p-6 shadow-sm backdrop-blur-sm
          sm:p-8
        ">
          <div className="h-6 w-56 rounded-full bg-foreground/8" />
          <div className="mt-4 h-4 w-full rounded-full bg-foreground/7" />
          <div className="mt-2 h-4 w-11/12 rounded-full bg-foreground/7" />
          <div className="mt-5 space-y-3">
            {Array.from({ length: 4 }, (_, index) => (
              <div
                key={index}
                className="h-4 w-full rounded-full bg-foreground/7"
              />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
