import { LoadingSpinner } from "@/components/LoadingSpinner";

export default function Loading() {
  return (
    <main className="
      mx-auto flex min-h-[70vh] w-full max-w-5xl items-center px-6 py-16
      sm:px-10
      lg:px-12
    ">
      <section className="
        imperial-card w-full space-y-8 bg-background/95 shadow-2xl shadow-black/10 backdrop-blur-sm
        dark:bg-card/95
      ">
        <div className="space-y-3">
          <div className="h-4 w-32 rounded-full bg-gold/12" />
          <div className="h-12 w-full max-w-sm rounded-full bg-foreground/7 sm:h-14" />
          <div className="h-4 w-full max-w-3xl rounded-full bg-foreground/8" />
          <div className="h-4 w-4/5 rounded-full bg-foreground/8" />
        </div>

        <div className="flex justify-center">
          <LoadingSpinner size="md" text="Waiting for a connection..." />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="bento-cell rounded-sm p-5">
            <div className="h-5 w-36 rounded-full bg-foreground/8" />
            <div className="mt-3 h-4 w-full rounded-full bg-foreground/7" />
            <div className="mt-2 h-4 w-5/6 rounded-full bg-foreground/7" />
          </div>

          <div className="bento-cell rounded-sm p-5">
            <div className="h-5 w-40 rounded-full bg-foreground/8" />
            <div className="mt-3 h-4 w-full rounded-full bg-foreground/7" />
            <div className="mt-2 h-4 w-4/5 rounded-full bg-foreground/7" />
          </div>
        </div>

        <div className="gold-line-thick" aria-hidden="true" />

        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="imperial-btn h-11 w-32 imperial-btn-fill rounded-full bg-foreground/7" />
          <div className="imperial-btn h-11 w-44 imperial-btn-ghost rounded-full bg-foreground/7" />
        </div>
      </section>
    </main>
  );
}
