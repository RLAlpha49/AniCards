import { headers } from "next/headers";

import { MarketingBackdrop } from "@/components/marketing/MarketingBackdrop";
import {
  buildUserLookupPath,
  getBlankSearchLookupError,
  getSearchLookupMode,
  getSearchLookupValidationError,
  getSearchPagePath,
  getSearchPagePrefillQuery,
  normalizeSearchLookupInput,
  type SearchLookupMode,
} from "@/lib/seo";

const DEFAULT_LOADING_NOSCRIPT_STYLES = `
  [data-loading-shell="true"] {
    display: none !important;
  }
`;

type SearchNoscriptLookupResult = {
  ctaLabel: string;
  description: string;
  eyebrow: string;
  href: string;
  identityLabel: string;
  title: string;
};

type SearchNoscriptState = {
  fieldError?: string;
  inputHint: string;
  inputLabel: string;
  inputMode: "numeric" | "search";
  inputPlaceholder: string;
  inputType: "search" | "text";
  lookupResult?: SearchNoscriptLookupResult;
  mode: SearchLookupMode;
  userIdModeHref: string;
  usernameModeHref: string;
  value: string;
};

function getSearchNoscriptInputMeta(searchMode: SearchLookupMode): {
  inputHint: string;
  inputLabel: string;
  inputMode: "numeric" | "search";
  inputPlaceholder: string;
  inputType: "search" | "text";
} {
  if (searchMode === "userId") {
    return {
      inputHint:
        "Paste a numeric AniList ID. AniList /user/... links also work when they resolve to an ID.",
      inputLabel: "AniList User ID",
      inputMode: "numeric",
      inputPlaceholder: "e.g., 542244 or /user/542244",
      inputType: "text",
    };
  }

  return {
    inputHint:
      "Paste a username, @handle, AniList profile URL, copied /user/... slug, or a bare numeric ID.",
    inputLabel: "AniList Username",
    inputMode: "search",
    inputPlaceholder: "e.g., Alpha49, @Alpha49, or /user/Alpha49",
    inputType: "search",
  };
}

function buildSearchNoscriptState(requestUrl: URL | null): SearchNoscriptState {
  const mode = getSearchLookupMode(
    requestUrl?.searchParams.get("mode") ?? undefined,
  );
  const rawQuery = requestUrl?.searchParams.get("query") ?? undefined;
  const value = getSearchPagePrefillQuery(rawQuery, mode);
  const inputMeta = getSearchNoscriptInputMeta(mode);
  const usernameModeHref = getSearchPagePath({
    query: value,
  });
  const userIdModeHref = getSearchPagePath({
    mode: "userId",
    query: value,
    includeDefaultMode: true,
  });

  if (rawQuery === undefined) {
    return {
      ...inputMeta,
      mode,
      userIdModeHref,
      usernameModeHref,
      value,
    };
  }

  const normalizedLookup = normalizeSearchLookupInput(rawQuery, mode);

  if (!normalizedLookup) {
    return {
      ...inputMeta,
      fieldError: getBlankSearchLookupError(mode),
      mode,
      userIdModeHref,
      usernameModeHref,
      value,
    };
  }

  if (!normalizedLookup.ok) {
    return {
      ...inputMeta,
      fieldError: getSearchLookupValidationError(mode, normalizedLookup.reason),
      mode,
      userIdModeHref,
      usernameModeHref,
      value,
    };
  }

  const href =
    normalizedLookup.mode === "userId"
      ? buildUserLookupPath({ userId: normalizedLookup.query })
      : buildUserLookupPath({ username: normalizedLookup.query });

  return {
    ...inputMeta,
    lookupResult: {
      ctaLabel: "Continue to editor",
      description:
        "AniCards can continue with this normalized lookup right away, even without JavaScript or a saved-profile confirmation.",
      eyebrow: "Ready to continue",
      href,
      identityLabel:
        normalizedLookup.mode === "userId"
          ? `AniList ID ${normalizedLookup.query}`
          : `@${normalizedLookup.query}`,
      title:
        normalizedLookup.mode === "userId"
          ? `Continue with AniList user ${normalizedLookup.query}`
          : `Continue with @${normalizedLookup.query}`,
    },
    mode,
    userIdModeHref,
    usernameModeHref,
    value,
  };
}

function SearchNoscriptFallback({
  requestUrl,
}: Readonly<{ requestUrl: URL | null }>) {
  const {
    fieldError,
    inputHint,
    inputLabel,
    inputMode,
    inputPlaceholder,
    inputType,
    lookupResult,
    mode,
    userIdModeHref,
    usernameModeHref,
    value,
  } = buildSearchNoscriptState(requestUrl);
  const isUserIdMode = mode === "userId";

  return (
    <section
      aria-labelledby="search-noscript-title"
      className="relative min-h-screen overflow-hidden"
      data-search-noscript-fallback="true"
    >
      <MarketingBackdrop />

      <section className="relative z-10 px-6 pt-28 pb-20 sm:px-12 md:pt-36 md:pb-28">
        <div className="mx-auto max-w-4xl text-center">
          <p className="mb-5 text-xs tracking-[0.6em] text-gold uppercase sm:text-sm">
            Profile Lookup
          </p>
          <h1
            id="search-noscript-title"
            className="mb-6 font-display text-5xl leading-[1.05] font-black sm:text-6xl md:text-7xl"
          >
            <span className="block text-foreground">UNLOCK</span>
            <span className="block text-gold">ANY PROFILE</span>
          </h1>
          <div className="gold-line-thick mx-auto mb-8 max-w-32" />
          <p className="
            mx-auto mb-12 max-w-2xl font-body-serif text-base/relaxed text-foreground/50
            sm:text-lg
          ">
            Search works without JavaScript too — submit the form, confirm the
            normalized lookup, and jump straight into the AniCards editor.
          </p>

          <div className="relative mx-auto w-full max-w-xl">
            <div className="
              pointer-events-none absolute -inset-8
              bg-[radial-gradient(ellipse_at_center,hsl(var(--gold)/0.10),transparent_70%)] blur-2xl
            " />

            <div className="
              relative border-2 border-gold/20 bg-background/80 p-8 text-left backdrop-blur-sm
              sm:p-10
            ">
              <div className="absolute -top-px -left-px size-5 border-t-2 border-l-2 border-gold" />
              <div className="absolute -top-px -right-px size-5 border-t-2 border-r-2 border-gold" />
              <div className="
                absolute -right-px -bottom-px size-5 border-r-2 border-b-2 border-gold
              " />
              <div className="absolute -bottom-px -left-px size-5 border-b-2 border-l-2 border-gold" />

              <div className="space-y-6">
                <div className="space-y-3">
                  <p className="
                    block font-display text-[0.6rem] tracking-[0.3em] text-foreground/50 uppercase
                  ">
                    Look Up By
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <a
                      href={usernameModeHref}
                      aria-current={isUserIdMode ? undefined : "page"}
                      className={[
                        "flex min-h-11 items-center justify-center border px-3 py-3 text-sm font-semibold transition-colors",
                        isUserIdMode
                          ? "border-gold/15 bg-gold/3 text-foreground/45"
                          : "border-gold/25 bg-gold/10 text-gold",
                      ].join(" ")}
                    >
                      Username
                    </a>
                    <a
                      href={userIdModeHref}
                      aria-current={isUserIdMode ? "page" : undefined}
                      className={[
                        "flex min-h-11 items-center justify-center border px-3 py-3 text-sm font-semibold transition-colors",
                        isUserIdMode
                          ? "border-gold/25 bg-gold/10 text-gold"
                          : "border-gold/15 bg-gold/3 text-foreground/45",
                      ].join(" ")}
                    >
                      User ID
                    </a>
                  </div>
                </div>

                <form
                  data-testid="search-form"
                  data-ui-ready="true"
                  method="get"
                  action="/search"
                  className="space-y-6"
                >
                  {isUserIdMode ? (
                    <input type="hidden" name="mode" value="userId" />
                  ) : null}

                  <div className="space-y-3">
                    <label
                      htmlFor="search-noscript-value"
                      className="
                        block font-display text-[0.6rem] tracking-[0.3em] text-foreground/50
                        uppercase
                      "
                    >
                      {inputLabel}
                    </label>
                    <input
                      id="search-noscript-value"
                      name="query"
                      type={inputType}
                      inputMode={inputMode}
                      defaultValue={value}
                      placeholder={inputPlaceholder}
                      autoComplete="off"
                      autoCapitalize="none"
                      autoCorrect="off"
                      enterKeyHint="search"
                      spellCheck={false}
                      aria-invalid={fieldError ? true : undefined}
                      className="
                        h-14 w-full border border-gold/15 bg-transparent px-4 text-base
                        transition-all
                        placeholder:text-foreground/25
                        hover:border-gold/30
                        focus:border-gold focus:ring-2 focus:ring-gold/20 focus:outline-none
                      "
                    />
                    <div className="space-y-1.5">
                      <p className="text-sm/relaxed text-foreground/45">
                        {inputHint}
                      </p>
                      {fieldError ? (
                        <p
                          role="alert"
                          className="text-sm font-medium text-red-700 dark:text-red-300"
                        >
                          {fieldError}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="
                      imperial-btn inline-flex h-14 w-full imperial-btn-fill items-center
                      justify-center text-base
                    "
                  >
                    Find Profile
                  </button>
                </form>

                <p className="text-center font-body-serif text-xs/relaxed text-foreground/30">
                  Works with public AniList usernames, copied profile links,
                  /user/... slugs, and bare numeric IDs.
                </p>
              </div>
            </div>
          </div>

          {lookupResult ? (
            <div
              className="
                mx-auto mt-6 max-w-3xl border border-gold/20 bg-background/70 p-4 text-left
                backdrop-blur-sm
              "
              data-testid="search-lookup-result"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-[0.7rem] tracking-[0.25em] text-gold/70 uppercase">
                    {lookupResult.eyebrow}
                  </p>
                  <p className="mt-1 text-sm/relaxed font-semibold text-foreground">
                    {lookupResult.title}
                  </p>
                  <p className="mt-1 text-xs/relaxed text-foreground/60 sm:text-sm/relaxed">
                    {lookupResult.description}
                  </p>
                  <p className="mt-2 text-xs tracking-[0.18em] text-foreground/40 uppercase">
                    {lookupResult.identityLabel}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 md:justify-end">
                  <a
                    href={lookupResult.href}
                    data-testid="search-lookup-cta"
                    className="
                      imperial-btn inline-flex min-h-11 imperial-btn-fill items-center
                      justify-center px-4 text-xs tracking-[0.15em] uppercase
                    "
                  >
                    {lookupResult.ctaLabel}
                  </a>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </section>
  );
}

function parseFallbackRequestUrl(candidate: string | null): URL | null {
  if (!candidate) {
    return null;
  }

  try {
    return new URL(candidate, "https://anicards.local");
  } catch {
    return null;
  }
}

async function getLoadingFallbackRequestUrl(): Promise<URL | null> {
  const requestHeaders = await headers();

  const routeCandidates = [
    requestHeaders.get("x-request-route"),
    requestHeaders.get("x-invoke-path"),
    requestHeaders.get("x-matched-path"),
    requestHeaders.get("x-next-url"),
    requestHeaders.get("next-url"),
  ];

  for (const candidate of routeCandidates) {
    const parsedUrl = parseFallbackRequestUrl(candidate);

    if (parsedUrl) {
      return parsedUrl;
    }
  }

  return null;
}

function DiamondDivider({ className }: Readonly<{ className?: string }>) {
  return (
    <div
      className={`flex items-center gap-3 ${className ?? ""}`}
      aria-hidden="true"
    >
      <div className="h-px flex-1 bg-linear-to-r from-transparent to-gold/20" />
      <div className="
        size-1.5 rotate-45 border border-gold/25 bg-gold/5
        motion-safe:skel-breathe
        motion-reduce:animate-none
      " />
      <div className="h-px flex-1 bg-linear-to-l from-transparent to-gold/20" />
    </div>
  );
}

export default async function Loading() {
  const requestUrl = await getLoadingFallbackRequestUrl();
  const isSearchRoute = requestUrl?.pathname === "/search";

  return (
    <>
      <noscript>
        <style>{DEFAULT_LOADING_NOSCRIPT_STYLES}</style>
        {isSearchRoute ? (
          <SearchNoscriptFallback requestUrl={requestUrl} />
        ) : (
          <section
            aria-labelledby="home-noscript-title"
            className="relative min-h-screen overflow-hidden"
          >
            <MarketingBackdrop lightOpacity={0.35} darkOpacity={0.22} />

            <section className="
              relative z-10 flex min-h-[70vh] items-center justify-center px-6 pt-28 pb-16
              sm:px-12
            ">
              <div className="mx-auto flex w-full max-w-3xl flex-col items-center text-center">
                <p className="mb-5 text-[0.65rem] tracking-[0.6em] text-gold uppercase sm:text-xs">
                  Your AniList Stats, Distilled
                </p>
                <h1
                  id="home-noscript-title"
                  className="
                    mb-6 font-display text-4xl leading-[1.1] font-black text-foreground
                    sm:text-5xl
                    lg:text-6xl
                  "
                >
                  YOUR ANIME
                  <br />
                  STORY,{" "}
                  <span className="text-gold">
                    CARVED
                    <br className="hidden sm:block" /> IN GOLD
                  </span>
                </h1>
                <div className="gold-line-thick mb-6 max-w-20" />
                <p className="
                  mb-10 max-w-md font-body-serif text-base/relaxed text-foreground/50
                  sm:text-lg
                ">
                  Sharp stat cards pulled straight from your AniList profile.
                  Deep analytics, bold visuals — and every detail is yours to
                  tweak.
                </p>
                <div className="flex flex-col gap-4 sm:flex-row">
                  <a href="/search" className="imperial-btn imperial-btn-fill">
                    Get Started
                  </a>
                  <a
                    href="/examples"
                    className="imperial-btn imperial-btn-ghost"
                  >
                    View Gallery
                  </a>
                </div>
              </div>
            </section>
          </section>
        )}
      </noscript>

      <section
        data-loading-shell="true"
        aria-busy="true"
        aria-labelledby="home-loading-status"
        className="relative min-h-screen overflow-hidden"
      >
        <p
          id="home-loading-status"
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
        >
          Loading home page
        </p>
        <MarketingBackdrop lightOpacity={0.35} darkOpacity={0.22} />

        {/* Hero Section */}
        <section className="
          relative z-10 flex min-h-[70vh] items-center justify-center px-4 pt-28 pb-16
        ">
          <div className="flex w-full max-w-3xl flex-col items-center text-center">
            {/* Label */}
            <div
              className="
                mb-6 flex items-center gap-2
                motion-safe:skel-reveal
                motion-reduce:animate-none
              "
              style={{ animationDelay: "0ms" }}
              aria-hidden="true"
            >
              <div className="h-px w-8 bg-gold/20" />
              <div className="skel-bone h-2.5 w-20" />
              <div className="h-px w-8 bg-gold/20" />
            </div>

            {/* Title */}
            <div
              className="
                skel-bone mb-3 h-11 w-80 max-w-full
                motion-safe:skel-reveal
                motion-reduce:animate-none
                sm:h-14 sm:w-104
              "
              style={{ animationDelay: "80ms" }}
              aria-hidden="true"
            />

            {/* Subtitle line 1 */}
            <div
              className="
                skel-bone mb-2 h-4 w-72 max-w-full
                motion-safe:skel-reveal
                motion-reduce:animate-none
                sm:w-96
              "
              style={{ animationDelay: "160ms" }}
              aria-hidden="true"
            />

            {/* Subtitle line 2 */}
            <div
              className="
                skel-bone mb-10 h-4 w-52 max-w-full
                motion-safe:skel-reveal
                motion-reduce:animate-none
                sm:w-72
              "
              style={{ animationDelay: "220ms" }}
              aria-hidden="true"
            />

            {/* CTA button */}
            <div
              className="
                skel-bone-rect h-12 w-44
                motion-safe:skel-reveal
                motion-reduce:animate-none
              "
              style={{ animationDelay: "300ms" }}
              aria-hidden="true"
            />
          </div>
        </section>

        {/* Divider */}
        <div
          className="
            relative z-10 mx-auto max-w-xs px-6 py-4
            motion-safe:skel-reveal
            motion-reduce:animate-none
          "
          style={{ animationDelay: "380ms" }}
        >
          <DiamondDivider />
        </div>

        {/* Card Marquee Strip */}
        <section
          className="relative z-10 overflow-hidden px-4 py-8"
          aria-hidden="true"
        >
          <div
            className="
              mx-auto flex max-w-6xl gap-4 overflow-hidden
              motion-safe:skel-reveal
              motion-reduce:animate-none
            "
            style={{ animationDelay: "440ms" }}
          >
            {Array.from({ length: 4 }, (_, i) => (
              <div
                key={i}
                className="skel-card h-44 w-64 shrink-0 sm:h-48 sm:w-72"
              />
            ))}
          </div>
        </section>

        {/* Divider */}
        <div
          className="
            relative z-10 mx-auto max-w-2xs p-6
            motion-safe:skel-reveal
            motion-reduce:animate-none
          "
          style={{ animationDelay: "520ms" }}
        >
          <DiamondDivider />
        </div>

        {/* Bento Features Grid */}
        <section className="relative z-10 px-4 py-10" aria-hidden="true">
          <div className="mx-auto grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <div
                key={i}
                className="
                  skel-card flex flex-col gap-4 p-6
                  motion-safe:skel-reveal
                  motion-reduce:animate-none
                "
                style={{ animationDelay: `${600 + i * 80}ms` }}
              >
                <div className="skel-bone-rect size-10" />
                <div className="skel-bone h-3.5 w-28" />
                <div className="space-y-2">
                  <div className="skel-bone h-2.5 w-full" />
                  <div className="skel-bone h-2.5 w-4/5" />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Stats Ribbon */}
        <section
          className="relative z-10 px-4 py-10 motion-safe:skel-reveal motion-reduce:animate-none"
          style={{ animationDelay: "1100ms" }}
          aria-hidden="true"
        >
          <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-10">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <div className="skel-bone h-8 w-16" />
                <div className="h-px w-10 bg-gold/10" />
                <div className="skel-bone h-2.5 w-14" />
              </div>
            ))}
          </div>
        </section>

        {/* Process Steps */}
        <section className="relative z-10 px-4 py-10" aria-hidden="true">
          <div
            className="
              skel-bone mx-auto mb-8 h-5 w-44
              motion-safe:skel-reveal
              motion-reduce:animate-none
            "
            style={{ animationDelay: "1200ms" }}
          />
          <div className="mx-auto grid max-w-4xl gap-6 sm:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => (
              <div
                key={i}
                className="
                  flex flex-col items-center gap-3 text-center
                  motion-safe:skel-reveal
                  motion-reduce:animate-none
                "
                style={{ animationDelay: `${1280 + i * 100}ms` }}
              >
                <div className="
                  flex size-12 items-center justify-center border border-gold/15 bg-gold/4
                ">
                  <div className="skel-bone h-4 w-5" />
                </div>
                <div className="skel-bone h-3.5 w-24" />
                <div className="skel-bone h-2.5 w-36" />
              </div>
            ))}
          </div>
        </section>

        {/* Bottom CTA */}
        <section
          className="
            relative z-10 flex flex-col items-center gap-4 px-4 py-16
            motion-safe:skel-reveal
            motion-reduce:animate-none
          "
          style={{ animationDelay: "1600ms" }}
          aria-hidden="true"
        >
          <div className="skel-bone h-6 w-60 max-w-full sm:w-72" />
          <div className="skel-bone h-3.5 w-44" />
          <div className="skel-bone-rect mt-2 h-12 w-40" />
        </section>
      </section>
    </>
  );
}
