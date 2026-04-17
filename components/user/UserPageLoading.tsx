import { LoadingSpinner } from "@/components/LoadingSpinner";
import PageShell from "@/components/PageShell";

export function UserPageLoadingSkeleton() {
  return (
    <PageShell>
      <output
        aria-live="polite"
        aria-busy="true"
        className="relative z-10 mx-auto block min-h-screen w-full max-w-7xl px-4 py-10"
      >
        {/* Header with decorative left border accent */}
        <div
          className="
            border-l-2 border-gold/40 pl-4
            motion-safe:skel-reveal
            motion-reduce:animate-none
          "
          style={{ animationDelay: "0ms" }}
        >
          <div className="space-y-2">
            <div className="skel-bone h-9 w-56" aria-hidden="true" />
            <div className="skel-bone h-4 w-96 max-w-full" aria-hidden="true" />
          </div>
        </div>

        {/* Toolbar strip */}
        <div
          className="mt-8 flex flex-wrap gap-3 motion-safe:skel-reveal motion-reduce:animate-none"
          style={{ animationDelay: "60ms" }}
          aria-hidden="true"
        >
          <div className="skel-bone-rect h-9 w-24" />
          <div className="skel-bone-rect h-9 w-28" />
          <div className="skel-bone-rect h-9 w-24" />
          <div className="skel-bone-rect h-9 w-20" />
        </div>

        {/* Search + filter row */}
        <div
          className="
            mt-6 flex flex-wrap items-center gap-3
            motion-safe:skel-reveal
            motion-reduce:animate-none
          "
          style={{ animationDelay: "120ms" }}
          aria-hidden="true"
        >
          <div className="skel-bone-rect h-10 w-full max-w-xs" />
          <div className="skel-bone h-8 w-20" />
          <div className="skel-bone h-8 w-24" />
          <div className="skel-bone h-8 w-16" />
        </div>

        {/* 3-column card grid */}
        <div
          className="
            mt-8 grid grid-cols-1 gap-4
            motion-safe:skel-reveal
            motion-reduce:animate-none
            sm:grid-cols-2
            lg:grid-cols-3
          "
          style={{ animationDelay: "200ms" }}
          aria-hidden="true"
        >
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={i}
              className="skel-card h-44 motion-safe:skel-breathe motion-reduce:animate-none"
              style={{ animationDelay: `${280 + i * 60}ms` }}
            />
          ))}
        </div>

        {/* Bottom action bar */}
        <div
          className="mt-10 flex gap-4 motion-safe:skel-reveal motion-reduce:animate-none"
          style={{ animationDelay: "640ms" }}
          aria-hidden="true"
        >
          <div className="skel-bone-rect h-10 w-32" />
          <div className="skel-bone-rect h-10 w-36" />
        </div>
      </output>
    </PageShell>
  );
}

export function UserPageLoadingSpinner(
  props: Readonly<{
    text?: string;
  }>,
) {
  return (
    <PageShell>
      <div className="
        relative z-10 container mx-auto flex min-h-screen items-center justify-center px-4
      ">
        <LoadingSpinner size="lg" text={props.text ?? "Loading user data..."} />
      </div>
    </PageShell>
  );
}
