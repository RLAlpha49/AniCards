import { LoadingSpinner } from "@/components/LoadingSpinner";
import { MarketingBackdrop } from "@/components/marketing/MarketingBackdrop";

export default function Loading() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <MarketingBackdrop lightOpacity={0.45} darkOpacity={0.25} />

      <section className="relative z-10 px-6 pt-28 pb-20 sm:px-12 md:pt-36 md:pb-28">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex items-center gap-4">
            <div className="
              h-px max-w-12 flex-1 bg-linear-to-r from-transparent to-[hsl(var(--gold)/0.5)]
            " />
            <span className="text-[0.6rem] tracking-[0.6em] text-gold uppercase sm:text-[0.65rem]">
              Showcase
            </span>
            <div className="
              h-px max-w-12 flex-1 bg-linear-to-l from-transparent to-[hsl(var(--gold)/0.5)]
            " />
          </div>

          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="w-full max-w-3xl space-y-4">
              <div className="
                h-12 w-72 max-w-full rounded-full bg-[hsl(var(--gold)/0.12)]
                sm:h-14 sm:w-96
              " />
              <div className="h-12 w-80 max-w-full rounded-full bg-foreground/6 sm:w-md" />
              <div className="h-4 w-64 max-w-full rounded-full bg-foreground/8 sm:w-96" />
            </div>

            <div className="flex justify-center lg:min-w-60 lg:justify-end">
              <LoadingSpinner size="md" text="Curating card examples..." />
            </div>
          </div>

          <div className="
            mt-12 rounded-[1.75rem] border border-gold/10 bg-background/75 p-5 backdrop-blur-xl
          ">
            <div className="h-11 rounded-full border border-gold/10 bg-background/80" />

            <div className="mt-4 flex flex-wrap gap-3">
              {Array.from({ length: 5 }, (_, index) => (
                <div
                  key={index}
                  className="h-8 rounded-full border border-gold/10 bg-background/65"
                  style={{ width: `${84 + index * 18}px` }}
                />
              ))}
            </div>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
              <div
                key={index}
                className="rounded-[1.75rem] border border-gold/10 bg-background/70 p-5"
              >
                <div className="h-40 rounded-2xl bg-foreground/6" />
                <div className="mt-5 h-4 w-32 rounded-full bg-[hsl(var(--gold)/0.14)]" />
                <div className="mt-3 h-3 w-full rounded-full bg-foreground/8" />
                <div className="mt-2 h-3 w-4/5 rounded-full bg-foreground/7" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
