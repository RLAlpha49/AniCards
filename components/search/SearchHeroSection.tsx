"use client";

import {
  motion,
  type TargetAndTransition,
  type Transition,
  useReducedMotion,
} from "framer-motion";
import {
  ArrowRight,
  Loader2,
  Search,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import { type MouseEvent, useCallback } from "react";

import { Button } from "@/components/ui/Button";
import {
  buildFadeUpVariants,
  buildMotionSafeStaggerContainer,
} from "@/lib/animations";
import type { SearchLookupMode } from "@/lib/seo";
import type {
  PendingSettingsTemplateApply,
  RememberedUserPageRoute,
} from "@/lib/user-page-settings-templates";

import { SearchForm } from "./SearchForm";

function getRememberedUserRouteTitle(route: RememberedUserPageRoute): string {
  return route.username ? `@${route.username}` : `AniList user ${route.userId}`;
}

type SearchHeroLookupResult = NonNullable<
  SearchHeroSectionProps["lookupResult"]
>;

function SearchHeroFloatingGlyph(
  props: Readonly<{
    animate: TargetAndTransition;
    className: string;
    glyph: string;
    prefersReducedMotion: boolean;
    transition: Transition;
  }>,
) {
  return (
    <motion.div
      className={props.className}
      animate={props.prefersReducedMotion ? undefined : props.animate}
      transition={props.prefersReducedMotion ? undefined : props.transition}
    >
      {props.glyph}
    </motion.div>
  );
}

function SearchHeroLookupAvatar(
  props: Readonly<{ lookupResult: SearchHeroLookupResult }>,
) {
  if (props.lookupResult.avatarUrl) {
    return (
      <img
        src={props.lookupResult.avatarUrl}
        alt=""
        className="size-full object-cover"
        loading="lazy"
      />
    );
  }

  if (props.lookupResult.kind === "confirmed") {
    return <UserRound className="size-5 text-gold-dim dark:text-gold" />;
  }

  return <Search className="size-5 text-gold-dim dark:text-gold" />;
}

interface SearchHeroSectionProps {
  initialFieldError?: string;
  initialSearchMode: SearchLookupMode;
  initialSearchValue: string;
  lastSuccessfulUserRoute?: RememberedUserPageRoute | null;
  lookupResult?: {
    avatarUrl?: string | null;
    ctaLabel: string;
    description: string;
    eyebrow: string;
    href: string;
    identityLabel?: string;
    isResolving?: boolean;
    kind: "confirmed" | "error" | "fallback" | "notFound";
    title: string;
    trackingSource: string;
  } | null;
  onLoadingChange: (loading: boolean) => void;
  onOpenResolvedLookup?: (href: string, trackingSource: string) => void;
  pendingTemplateApply?: PendingSettingsTemplateApply | null;
  onClearPendingTemplateApply?: () => void;
  onResumeLastEditor?: () => void;
}

export function SearchHeroSection({
  initialFieldError,
  initialSearchMode,
  initialSearchValue,
  lastSuccessfulUserRoute,
  lookupResult,
  onLoadingChange,
  onOpenResolvedLookup,
  pendingTemplateApply,
  onClearPendingTemplateApply,
  onResumeLastEditor,
}: Readonly<SearchHeroSectionProps>) {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const containerVariants = buildMotionSafeStaggerContainer({
    reducedMotion: prefersReducedMotion,
    staggerChildren: 0.1,
    delayChildren: 0.1,
  });
  const itemVariants = buildFadeUpVariants({
    reducedMotion: prefersReducedMotion,
    distance: 28,
    duration: 0.7,
  });
  const handleLookupLinkClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      if (
        !lookupResult ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      event.preventDefault();
      onOpenResolvedLookup?.(lookupResult.href, lookupResult.trackingSource);
    },
    [lookupResult, onOpenResolvedLookup],
  );

  return (
    <section className="relative overflow-hidden px-6 pt-28 pb-24 sm:px-12 md:pt-36 md:pb-32">
      {/* Concentric ring background — sonar/radar motif */}
      <div className="pointer-events-none absolute inset-0 search-hero-radar" />

      {/* Central gold glow */}
      <div className="
        pointer-events-none absolute top-1/3 left-1/2 h-125 w-150 -translate-1/2 rounded-full
        bg-[hsl(var(--gold)/0.06)] blur-[140px]
      " />

      {/* Floating decorative elements */}
      <SearchHeroFloatingGlyph
        className="pointer-events-none absolute top-24 left-[8%] text-5xl text-gold/10 select-none"
        glyph="◆"
        prefersReducedMotion={prefersReducedMotion}
        animate={{ y: [0, -15, 0], rotate: [0, 12, 0] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
      />
      <SearchHeroFloatingGlyph
        className="
          pointer-events-none absolute right-[10%] bottom-32 text-3xl text-gold/8 select-none
        "
        glyph="✦"
        prefersReducedMotion={prefersReducedMotion}
        animate={{ y: [0, 12, 0], rotate: [0, -8, 0] }}
        transition={{
          duration: 7,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 2,
        }}
      />
      <SearchHeroFloatingGlyph
        className="
          pointer-events-none absolute top-[50%] left-[5%] hidden text-2xl text-gold/6 select-none
          md:block
        "
        glyph="◇"
        prefersReducedMotion={prefersReducedMotion}
        animate={{ y: [0, -10, 0], opacity: [0.4, 0.8, 0.4] }}
        transition={{
          duration: 6,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1,
        }}
      />
      <SearchHeroFloatingGlyph
        className="
          pointer-events-none absolute top-[20%] right-[6%] hidden text-xl text-gold/5 select-none
          lg:block
        "
        glyph="◇"
        prefersReducedMotion={prefersReducedMotion}
        animate={{ y: [0, 8, 0], rotate: [0, -15, 0] }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 3,
        }}
      />

      <motion.div
        variants={containerVariants}
        initial={false}
        animate="visible"
        className="relative z-10 mx-auto max-w-4xl text-center"
      >
        <motion.p
          variants={itemVariants}
          initial={false}
          className="mb-5 text-xs tracking-[0.6em] text-gold uppercase sm:text-sm"
        >
          Profile Lookup
        </motion.p>

        <motion.h1
          variants={itemVariants}
          initial={false}
          className="
            mb-6 font-display text-5xl leading-[1.05] font-black
            sm:text-6xl
            md:text-7xl
            lg:text-8xl
          "
        >
          <span className="block text-foreground">UNLOCK</span>
          <span className="block text-gold">ANY PROFILE</span>
        </motion.h1>

        <motion.div
          variants={itemVariants}
          initial={false}
          className="gold-line-thick mx-auto mb-8 max-w-32"
        />

        <motion.p
          variants={itemVariants}
          initial={false}
          className="
            mx-auto mb-6 max-w-lg font-body-serif text-base/relaxed text-foreground/45
            sm:text-lg
          "
        >
          Punch in a username or ID, and we&apos;ll pull together stunning stat
          cards from any public AniList profile — ready to customize and share
          wherever you like.
        </motion.p>

        <motion.div
          variants={itemVariants}
          initial={false}
          className="
            mb-14 flex flex-wrap justify-center gap-x-8 gap-y-2 text-xs tracking-[0.2em]
            text-foreground/30 uppercase
          "
        >
          <span>✦ Instant Results</span>
          <span>✦ No Account Needed</span>
          <span>✦ One-Click Setup</span>
        </motion.div>

        {lastSuccessfulUserRoute ? (
          <motion.div
            variants={itemVariants}
            initial={false}
            className="
              mx-auto mb-8 max-w-3xl border border-gold/20 bg-background/70 p-4 text-left
              backdrop-blur-sm
            "
            data-testid="search-last-editor-card"
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <div className="
                  mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-gold/15
                  dark:bg-gold/10
                ">
                  <UserRound className="size-4.5 text-gold-dim dark:text-gold" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-[0.7rem] tracking-[0.25em] text-gold/70 uppercase">
                    Continue where you left off
                  </p>
                  <p className="mt-1 text-sm/relaxed font-semibold text-foreground">
                    {getRememberedUserRouteTitle(lastSuccessfulUserRoute)}
                  </p>
                  <p className="mt-1 text-xs/relaxed text-foreground/60 sm:text-sm/relaxed">
                    Jump straight back into the last editor AniCards loaded in
                    this browser session and keep shaping the same profile.
                  </p>
                  <p className="mt-2 text-xs tracking-[0.18em] text-foreground/40 uppercase">
                    AniList ID {lastSuccessfulUserRoute.userId}
                  </p>
                  {pendingTemplateApply ? (
                    <p className="mt-2 text-xs/relaxed text-gold/80">
                      <span className="font-semibold text-gold-dim dark:text-gold">
                        {pendingTemplateApply.templateName ?? "Queued style"}
                      </span>{" "}
                      is already queued and will apply as soon as the editor
                      opens.
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 md:justify-end">
                <Button
                  type="button"
                  size="sm"
                  onClick={onResumeLastEditor}
                  className="
                    imperial-btn min-h-11 imperial-btn-fill px-4 text-xs tracking-[0.15em] uppercase
                  "
                >
                  Resume last editor
                  <ArrowRight className="ml-2 size-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          </motion.div>
        ) : null}

        {pendingTemplateApply ? (
          <motion.div
            variants={itemVariants}
            initial={false}
            className="
              mx-auto mb-8 max-w-3xl border border-gold/20 bg-background/70 p-4 text-left
              backdrop-blur-sm
            "
            data-testid="search-pending-template"
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <div className="
                  mt-0.5 flex size-9 shrink-0 items-center justify-center bg-gold/15
                  dark:bg-gold/10
                ">
                  <Sparkles className="size-4 text-gold-dim dark:text-gold" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-[0.7rem] tracking-[0.25em] text-gold/70 uppercase">
                    Queued style ready
                  </p>
                  <p className="mt-1 text-sm/relaxed text-foreground/85">
                    <span className="font-semibold text-foreground">
                      {pendingTemplateApply.templateName ?? "Queued style"}
                    </span>{" "}
                    will be applied in <strong>Global Settings</strong> the next
                    time you open the editor.
                  </p>
                  <p className="mt-2 text-xs/relaxed text-foreground/55">
                    AniCards will carry this queued look into the next editor
                    session you open from search, examples, or a remembered
                    profile.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 md:justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onClearPendingTemplateApply}
                  className="
                    min-h-11 px-3 text-xs tracking-[0.15em] text-foreground/65 uppercase
                    hover:bg-gold/5 hover:text-foreground
                  "
                >
                  <X className="mr-1.5 size-4" aria-hidden="true" />
                  Clear queued style
                </Button>
              </div>
            </div>
          </motion.div>
        ) : null}

        <motion.div variants={itemVariants} initial={false}>
          <SearchForm
            initialFieldError={initialFieldError}
            initialSearchMode={initialSearchMode}
            initialSearchValue={initialSearchValue}
            onLoadingChange={onLoadingChange}
          />
        </motion.div>

        {lookupResult ? (
          <motion.div
            variants={itemVariants}
            initial={false}
            className="
              mx-auto mt-6 max-w-3xl border border-gold/20 bg-background/70 p-4 text-left
              backdrop-blur-sm
            "
            data-testid="search-lookup-result"
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <div className="
                  mt-0.5 flex size-11 shrink-0 items-center justify-center overflow-hidden
                  rounded-full bg-gold/15
                  dark:bg-gold/10
                ">
                  <SearchHeroLookupAvatar lookupResult={lookupResult} />
                </div>

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
                  {lookupResult.identityLabel ? (
                    <p className="mt-2 text-xs tracking-[0.18em] text-foreground/40 uppercase">
                      {lookupResult.identityLabel}
                    </p>
                  ) : null}
                  {lookupResult.isResolving ? (
                    <p
                      role="status"
                      aria-live="polite"
                      className="mt-2 inline-flex items-center gap-2 text-xs text-foreground/50"
                    >
                      <Loader2 className="size-3.5 animate-spin" />
                      Checking saved profile…
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 md:justify-end">
                <Button
                  asChild
                  size="sm"
                  className="
                    imperial-btn min-h-11 imperial-btn-fill px-4 text-xs tracking-[0.15em] uppercase
                  "
                >
                  <a
                    href={lookupResult.href}
                    data-testid="search-lookup-cta"
                    onClick={handleLookupLinkClick}
                  >
                    {lookupResult.ctaLabel}
                    <ArrowRight className="ml-2 size-4" aria-hidden="true" />
                  </a>
                </Button>
              </div>
            </div>
          </motion.div>
        ) : null}
      </motion.div>
    </section>
  );
}
