export default function Loading() {
  return (
    <section
      aria-busy="true"
      aria-labelledby="offline-loading-status"
      className="
        mx-auto flex min-h-[70vh] w-full max-w-5xl items-center px-6 py-16
        sm:px-10
        lg:px-12
      "
    >
      <p
        id="offline-loading-status"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        Loading offline page
      </p>
      <div className="w-full">
        <section className="
          imperial-card w-full space-y-8 bg-background/95 shadow-2xl shadow-black/10
          backdrop-blur-sm
          dark:bg-card/95
        ">
          {/* Label + title + description bones */}
          <div
            className="
              space-y-3 border-l-2 border-gold/20 pl-4
              motion-safe:skel-reveal
              motion-reduce:animate-none
            "
            style={{ animationDelay: "0ms" }}
          >
            <div className="flex items-center gap-2" aria-hidden="true">
              <div className="skel-bone h-2.5 w-24" />
              <div className="size-1 rotate-45 bg-gold/20" />
            </div>
            <div
              className="skel-bone h-12 w-full max-w-sm sm:h-14"
              aria-hidden="true"
            />
            <div
              className="skel-bone h-4 w-full max-w-3xl"
              aria-hidden="true"
            />
            <div className="skel-bone h-4 w-4/5" aria-hidden="true" />
          </div>

          {/* Two bento-cell sub-cards */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div
              className="
                bento-cell rounded-sm p-5
                motion-safe:skel-reveal
                motion-reduce:animate-none
              "
              style={{ animationDelay: "80ms" }}
              aria-hidden="true"
            >
              <div className="skel-bone h-5 w-36" />
              <div className="skel-bone mt-3 h-4 w-full" />
              <div className="skel-bone mt-2 h-4 w-5/6" />
            </div>

            <div
              className="
                bento-cell rounded-sm p-5
                motion-safe:skel-reveal
                motion-reduce:animate-none
              "
              style={{ animationDelay: "160ms" }}
              aria-hidden="true"
            >
              <div className="skel-bone h-5 w-40" />
              <div className="skel-bone mt-3 h-4 w-full" />
              <div className="skel-bone mt-2 h-4 w-4/5" />
            </div>
          </div>

          {/* Divider */}
          <div
            className="gold-line-thick motion-safe:skel-reveal motion-reduce:animate-none"
            style={{ animationDelay: "240ms" }}
            aria-hidden="true"
          />

          {/* CTA button bones */}
          <div
            className="
              flex flex-col gap-4
              motion-safe:skel-reveal
              motion-reduce:animate-none
              sm:flex-row
            "
            style={{ animationDelay: "320ms" }}
          >
            <div className="skel-bone-rect h-11 w-32" aria-hidden="true" />
            <div className="skel-bone-rect h-11 w-44" aria-hidden="true" />
          </div>
        </section>
      </div>
    </section>
  );
}
