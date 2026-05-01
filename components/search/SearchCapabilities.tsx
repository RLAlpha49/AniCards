"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Loader2, Search, Sparkles, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type MouseEvent, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/Button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/Popover";
import { EASE_OUT_EXPO } from "@/lib/animations";
import type { SettingsTemplateV1 } from "@/lib/user-page-settings-io";
import {
  getExamplesDiscoveryContextLabel,
  getExamplesDiscoveryContextReturnLabel,
  getRememberedUserPageRouteLabel,
  queueSettingsTemplateForEditor,
  readSearchLaunchContinuityState,
  rememberExamplesDiscoveryContext,
  type SearchLaunchContinuityState,
  type SearchLaunchDiscoveryContextInput,
  subscribeSearchLaunchContinuity,
} from "@/lib/user-page-settings-templates";
import {
  EDITOR_STARTER_STYLES,
  type EditorStarterStyle,
} from "@/lib/user-page-starters";
import { cn } from "@/lib/utils";

const EMPTY_CONTINUITY_STATE: SearchLaunchContinuityState = {
  pendingTemplateApply: null,
  lastSuccessfulUserRoute: null,
  recentSuccessfulUserRoutes: [],
  lastDiscoveryContext: null,
};

function getRememberedUserRouteTitle(
  route: SearchLaunchContinuityState["lastSuccessfulUserRoute"],
): string {
  if (!route) {
    return "Your last editor shows up here";
  }

  return getRememberedUserPageRouteLabel(route);
}

function focusSearchForm(reducedMotion: boolean): void {
  if (globalThis.document === undefined) return;

  const form = globalThis.document.querySelector('[data-testid="search-form"]');
  if (!(form instanceof HTMLElement)) {
    return;
  }

  form.scrollIntoView({
    behavior: reducedMotion ? "auto" : "smooth",
    block: "center",
  });

  const queryInput = form.querySelector('input[name="query"]');
  if (queryInput instanceof HTMLInputElement) {
    queryInput.focus();
  }
}

function buildStarterStyleTemplate(
  starterStyle: EditorStarterStyle,
): SettingsTemplateV1 {
  const now = Date.now();

  return {
    id: starterStyle.id,
    name: starterStyle.name,
    snapshot: starterStyle.snapshot,
    createdAt: now,
    updatedAt: now,
  };
}

function getQueuedStyleMessage(
  pendingTemplateName: string | null | undefined,
  discoveryContextLabel: string | null,
): string {
  if (pendingTemplateName) {
    return `${pendingTemplateName} is already queued and will apply the moment the editor opens.`;
  }

  if (discoveryContextLabel) {
    return `Queue one of the starter looks on the right, then search above, reopen a recent editor, or head back to ${discoveryContextLabel} without losing the thread.`;
  }

  return "Queue one of the starter looks on the right, then search above or reopen your last editor to carry it forward.";
}

function renderResumeLastEditorButtonContent(params: {
  hasLastEditor: boolean;
  isBusy: boolean;
}) {
  if (params.isBusy) {
    return (
      <>
        <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
        Opening editor…
      </>
    );
  }

  if (params.hasLastEditor) {
    return (
      <>
        Resume last editor
        <ArrowRight className="ml-2 size-4" aria-hidden="true" />
      </>
    );
  }

  return (
    <>
      Focus search form
      <Search className="ml-2 size-4" aria-hidden="true" />
    </>
  );
}

function getStarterQueueSuccessDescription(options: {
  discoveryContextLabel: string | null;
  lastRoute: SearchLaunchContinuityState["lastSuccessfulUserRoute"];
  fallbackBehavior: "focus-search" | "route";
}) {
  if (options.lastRoute) {
    return `Reopening ${getRememberedUserRouteTitle(options.lastRoute)} so AniCards can apply it there.`;
  }

  if (options.discoveryContextLabel) {
    return options.fallbackBehavior === "focus-search"
      ? `Use the search form above and AniCards will carry this look into the editor while keeping ${options.discoveryContextLabel} close by.`
      : `AniCards will carry this look into the next editor you open while keeping ${options.discoveryContextLabel} ready.`;
  }

  return options.fallbackBehavior === "focus-search"
    ? "Use the search form above and AniCards will carry this style into the editor."
    : "AniCards will carry this style into the next editor you open.";
}

export interface SearchLaunchChooserProps {
  align?: "start" | "center";
  className?: string;
  discoveryContext?: SearchLaunchDiscoveryContextInput | null;
  fallbackHref?: string;
  fallbackLabel?: string;
  onFallbackSearchClick?: () => void;
  searchFallbackBehavior?: "focus-search" | "route";
  showDiscoveryHint?: boolean;
}

export function SearchLaunchChooser({
  align = "start",
  className,
  discoveryContext,
  fallbackHref = "/search",
  fallbackLabel = "Search for a user",
  onFallbackSearchClick,
  searchFallbackBehavior = "route",
  showDiscoveryHint = true,
}: Readonly<SearchLaunchChooserProps>) {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion() ?? false;
  const [continuityState, setContinuityState] =
    useState<SearchLaunchContinuityState>(EMPTY_CONTINUITY_STATE);
  const [busyActionId, setBusyActionId] = useState<string | null>(null);
  const [isStarterMenuOpen, setIsStarterMenuOpen] = useState(false);

  const syncContinuityState = useCallback(() => {
    setContinuityState(readSearchLaunchContinuityState());
  }, []);

  useEffect(() => {
    syncContinuityState();
    return subscribeSearchLaunchContinuity(syncContinuityState);
  }, [syncContinuityState]);

  const effectiveDiscoveryContext =
    discoveryContext ?? continuityState.lastDiscoveryContext ?? undefined;
  const discoveryContextLabel = effectiveDiscoveryContext
    ? getExamplesDiscoveryContextLabel(effectiveDiscoveryContext)
    : null;
  const hasLastEditor = Boolean(continuityState.lastSuccessfulUserRoute?.href);
  const fallbackButtonClassName = cn(
    "min-h-11 px-4 text-xs tracking-[0.15em] uppercase",
    hasLastEditor
      ? "border-gold/20 bg-background/70 hover:bg-gold/5"
      : "imperial-btn imperial-btn-fill",
  );

  const rememberDiscoveryThread = useCallback(() => {
    if (effectiveDiscoveryContext) {
      rememberExamplesDiscoveryContext(effectiveDiscoveryContext);
    }
  }, [effectiveDiscoveryContext]);

  const handleFallbackLinkClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      if (busyActionId !== null) {
        event.preventDefault();
        return;
      }

      rememberDiscoveryThread();
      onFallbackSearchClick?.();

      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      setBusyActionId("fallback-search");
    },
    [busyActionId, onFallbackSearchClick, rememberDiscoveryThread],
  );

  const handleFallbackSearch = useCallback(() => {
    rememberDiscoveryThread();
    onFallbackSearchClick?.();

    if (searchFallbackBehavior === "focus-search") {
      focusSearchForm(prefersReducedMotion);
      return;
    }

    setBusyActionId("fallback-search");
    void Promise.resolve(router.push(fallbackHref)).catch(() => {
      setBusyActionId(null);
      toast.error("Couldn't open search", {
        description: "Try refreshing the page and searching again.",
      });
    });
  }, [
    fallbackHref,
    onFallbackSearchClick,
    prefersReducedMotion,
    rememberDiscoveryThread,
    router,
    searchFallbackBehavior,
  ]);

  const handleResumeLastEditor = useCallback(() => {
    const href = continuityState.lastSuccessfulUserRoute?.href;
    if (!href) {
      handleFallbackSearch();
      return;
    }

    rememberDiscoveryThread();
    setBusyActionId("resume-last-editor");
    void Promise.resolve(router.push(href)).catch(() => {
      setBusyActionId(null);
      toast.error("Couldn't reopen the last editor", {
        description:
          searchFallbackBehavior === "focus-search"
            ? "Try the search form above instead."
            : "Try searching for a profile instead.",
      });
    });
  }, [
    continuityState.lastSuccessfulUserRoute?.href,
    handleFallbackSearch,
    rememberDiscoveryThread,
    router,
    searchFallbackBehavior,
  ]);

  const handleQueueStarterStyle = useCallback(
    (starterStyle: EditorStarterStyle) => {
      rememberDiscoveryThread();

      const queueResult = queueSettingsTemplateForEditor(
        buildStarterStyleTemplate(starterStyle),
        {
          source: "search-starter",
          discoveryContext: effectiveDiscoveryContext,
        },
      );

      if (!queueResult.ok) {
        toast.error("Couldn't queue this starter style", {
          description: queueResult.error,
        });
        return;
      }

      const lastRoute = continuityState.lastSuccessfulUserRoute;
      setIsStarterMenuOpen(false);
      toast.success("Style queued for your editor", {
        description: getStarterQueueSuccessDescription({
          discoveryContextLabel,
          lastRoute,
          fallbackBehavior: searchFallbackBehavior,
        }),
      });

      if (lastRoute?.href) {
        setBusyActionId(starterStyle.id);
        void Promise.resolve(router.push(lastRoute.href)).catch(() => {
          setBusyActionId(null);
          toast.error("Couldn't open the last editor", {
            description:
              searchFallbackBehavior === "focus-search"
                ? "The style is still queued — try the search form above instead."
                : "The style is still queued — try searching for a profile instead.",
          });
        });
        return;
      }

      handleFallbackSearch();
    },
    [
      continuityState.lastSuccessfulUserRoute,
      discoveryContextLabel,
      effectiveDiscoveryContext,
      handleFallbackSearch,
      rememberDiscoveryThread,
      router,
      searchFallbackBehavior,
    ],
  );

  return (
    <div
      className={cn(
        "flex flex-col gap-3",
        align === "center" ? "items-center text-center" : undefined,
        className,
      )}
    >
      <div
        className={cn(
          "flex flex-wrap items-center gap-3",
          align === "center" ? "justify-center" : undefined,
        )}
      >
        {hasLastEditor ? (
          <Button
            type="button"
            size="sm"
            onClick={handleResumeLastEditor}
            disabled={
              busyActionId !== null && busyActionId !== "resume-last-editor"
            }
            className="
              imperial-btn min-h-11 imperial-btn-fill px-4 text-xs tracking-[0.15em] uppercase
            "
          >
            {renderResumeLastEditorButtonContent({
              hasLastEditor,
              isBusy: busyActionId === "resume-last-editor",
            })}
          </Button>
        ) : null}

        {searchFallbackBehavior === "route" ? (
          <Button
            asChild
            variant={hasLastEditor ? "outline" : undefined}
            size="sm"
            className={cn(
              fallbackButtonClassName,
              busyActionId !== null
                ? "pointer-events-none opacity-50"
                : undefined,
            )}
          >
            <Link
              href={fallbackHref}
              onClick={handleFallbackLinkClick}
              aria-disabled={busyActionId !== null ? true : undefined}
              tabIndex={busyActionId !== null ? -1 : undefined}
            >
              {busyActionId === "fallback-search" ? (
                <>
                  <Loader2
                    className="mr-2 size-4 animate-spin"
                    aria-hidden="true"
                  />
                  Opening search…
                </>
              ) : (
                fallbackLabel
              )}
            </Link>
          </Button>
        ) : (
          <Button
            type="button"
            variant={hasLastEditor ? "outline" : undefined}
            size="sm"
            onClick={handleFallbackSearch}
            disabled={
              busyActionId !== null && busyActionId !== "fallback-search"
            }
            className={fallbackButtonClassName}
          >
            {busyActionId === "fallback-search" ? (
              <>
                <Loader2
                  className="mr-2 size-4 animate-spin"
                  aria-hidden="true"
                />
                Opening search…
              </>
            ) : (
              fallbackLabel
            )}
          </Button>
        )}

        <Popover open={isStarterMenuOpen} onOpenChange={setIsStarterMenuOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busyActionId !== null}
              className="
                min-h-11 border-gold/20 bg-background/70 px-4 text-xs tracking-[0.15em] uppercase
                hover:bg-gold/5
              "
            >
              <Sparkles className="mr-2 size-4" aria-hidden="true" />
              Start with a look
            </Button>
          </PopoverTrigger>

          <PopoverContent
            align={align === "center" ? "center" : "start"}
            className="
              w-[min(24rem,calc(100vw-2rem))] border-gold/15 bg-background/95 p-0 backdrop-blur-xl
            "
          >
            <div className="border-b border-gold/10 px-4 py-3">
              <p className="text-[0.68rem] tracking-[0.22em] text-gold/70 uppercase">
                Starter looks
              </p>
              <p className="mt-1 text-xs/relaxed text-foreground/55">
                Queue a ready-made look first, then open the next editor without
                rebuilding the style by hand.
              </p>
            </div>

            <div className="space-y-1 p-2">
              {EDITOR_STARTER_STYLES.map((starterStyle) => (
                <button
                  key={starterStyle.id}
                  type="button"
                  onClick={() => handleQueueStarterStyle(starterStyle)}
                  disabled={busyActionId !== null}
                  className="
                    flex w-full items-start justify-between gap-3 rounded-sm p-3 text-left
                    transition-colors
                    hover:bg-gold/6
                    focus-visible:bg-gold/6 focus-visible:outline-none
                  "
                >
                  <div>
                    <p className="text-[0.68rem] tracking-[0.2em] text-gold/65 uppercase">
                      {starterStyle.intentLabel}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {starterStyle.name}
                    </p>
                    <p className="mt-1 text-xs/relaxed text-foreground/52">
                      {starterStyle.description}
                    </p>
                  </div>

                  {busyActionId === starterStyle.id ? (
                    <Loader2
                      className="mt-0.5 size-4 shrink-0 animate-spin text-gold"
                      aria-hidden="true"
                    />
                  ) : (
                    <ArrowRight
                      className="mt-0.5 size-4 shrink-0 text-gold/75"
                      aria-hidden="true"
                    />
                  )}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {showDiscoveryHint && discoveryContextLabel ? (
        <p className="max-w-2xl text-xs/relaxed text-gold/80">
          AniCards will keep{" "}
          <span className="font-semibold">{discoveryContextLabel}</span> ready
          while you launch, so the examples thread survives the detour.
        </p>
      ) : null}
    </div>
  );
}

export function SearchCapabilities() {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion() ?? false;
  const [continuityState, setContinuityState] =
    useState<SearchLaunchContinuityState>(EMPTY_CONTINUITY_STATE);
  const [busyActionId, setBusyActionId] = useState<string | null>(null);

  const syncContinuityState = useCallback(() => {
    setContinuityState(readSearchLaunchContinuityState());
  }, []);

  useEffect(() => {
    syncContinuityState();
    return subscribeSearchLaunchContinuity(syncContinuityState);
  }, [syncContinuityState]);

  const handleQueueStarterStyle = useCallback(
    (starterStyle: EditorStarterStyle) => {
      const queueResult = queueSettingsTemplateForEditor(
        buildStarterStyleTemplate(starterStyle),
        {
          source: "search-starter",
          discoveryContext: continuityState.lastDiscoveryContext ?? undefined,
        },
      );

      if (!queueResult.ok) {
        toast.error("Couldn't queue this starter style", {
          description: queueResult.error,
        });
        return;
      }

      const lastRoute = continuityState.lastSuccessfulUserRoute;
      toast.success("Style queued for your editor", {
        description: lastRoute
          ? `Reopening ${getRememberedUserRouteTitle(lastRoute)} so AniCards can apply it there.`
          : "Use the search form above and AniCards will carry this style into the editor.",
      });

      if (lastRoute?.href) {
        setBusyActionId(starterStyle.id);
        void Promise.resolve(router.push(lastRoute.href)).catch(() => {
          setBusyActionId(null);
          toast.error("Couldn't open the last editor", {
            description:
              "The style is still queued — try searching for a profile above.",
          });
        });
        return;
      }

      focusSearchForm(prefersReducedMotion);
    },
    [
      continuityState.lastDiscoveryContext,
      continuityState.lastSuccessfulUserRoute,
      prefersReducedMotion,
      router,
    ],
  );

  const hasLastEditor = Boolean(continuityState.lastSuccessfulUserRoute?.href);
  const pendingTemplateName =
    continuityState.pendingTemplateApply?.templateName;
  const discoveryContextLabel = continuityState.lastDiscoveryContext
    ? getExamplesDiscoveryContextLabel(continuityState.lastDiscoveryContext)
    : null;
  const queuedStyleMessage = getQueuedStyleMessage(
    pendingTemplateName,
    discoveryContextLabel,
  );
  const additionalRecentUserRoutes = continuityState.recentSuccessfulUserRoutes
    .filter(
      (route) => route.href !== continuityState.lastSuccessfulUserRoute?.href,
    )
    .slice(0, 3);
  const examplesHref =
    continuityState.lastDiscoveryContext?.href ?? "/examples";
  const examplesLabel = continuityState.lastDiscoveryContext
    ? getExamplesDiscoveryContextReturnLabel(
        continuityState.lastDiscoveryContext,
      )
    : "Browse live examples";

  return (
    <section className="px-6 py-20 sm:px-12 md:py-28">
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
        whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6 }}
        className="mb-16 text-center"
      >
        <p className="mb-4 text-xs tracking-[0.5em] text-gold uppercase sm:text-sm">
          Launch Faster
        </p>
        <h2 className="mb-4 font-display text-3xl tracking-[0.15em] text-foreground sm:text-4xl">
          KEEP YOUR MOMENTUM
        </h2>
        <div className="gold-line-thick mx-auto max-w-20" />
        <p className="
          mx-auto mt-5 max-w-2xl font-body-serif text-sm/relaxed text-foreground/45
          sm:text-base/relaxed
        ">
          AniCards keeps your last confirmed editor route nearby and lets you
          queue a reusable starter look before you launch the next profile.
          It&apos;s continuity with a little more ceremony and a lot less
          rework.
        </p>
      </motion.div>

      <div className="
        mx-auto grid max-w-6xl gap-8
        xl:grid-cols-[minmax(0,1fr)_minmax(0,1.45fr)] xl:items-start
      ">
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 30 }}
          whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.55, ease: EASE_OUT_EXPO }}
          className="border-2 border-gold/15 bg-gold/3 p-6"
        >
          <div className="flex items-start gap-3">
            <div className="
              mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-full bg-gold/12
              dark:bg-gold/10
            ">
              <UserRound className="size-5 text-gold-dim dark:text-gold" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-[0.7rem] tracking-[0.25em] text-gold/70 uppercase">
                Session continuity
              </p>
              <h3 className="mt-1 font-display text-xl tracking-[0.12em] text-foreground uppercase">
                {getRememberedUserRouteTitle(
                  continuityState.lastSuccessfulUserRoute,
                )}
              </h3>
              <p className="
                mt-3 font-body-serif text-sm/relaxed text-foreground/55
                sm:text-base/relaxed
              ">
                {hasLastEditor
                  ? "Jump back into the last editor AniCards loaded in this browser session, then keep refining the same profile without re-running the lookup."
                  : "Open any profile once and AniCards keeps that editor route handy here, so the next return trip is one tap instead of another search."}
              </p>

              {continuityState.lastSuccessfulUserRoute ? (
                <p className="mt-3 text-xs tracking-[0.18em] text-foreground/35 uppercase">
                  AniList ID {continuityState.lastSuccessfulUserRoute.userId}
                </p>
              ) : null}

              {discoveryContextLabel ? (
                <p className="mt-3 text-xs/relaxed text-gold/80">
                  {discoveryContextLabel} is still remembered here too, so your
                  examples detour can stay exact instead of snapping back to the
                  generic gallery.
                </p>
              ) : null}

              <p className="mt-3 text-xs/relaxed text-foreground/45">
                {queuedStyleMessage}
              </p>

              {additionalRecentUserRoutes.length > 0 ? (
                <div className="mt-4">
                  <p className="text-[0.68rem] tracking-[0.2em] text-foreground/35 uppercase">
                    Recent editors
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {additionalRecentUserRoutes.map((route) => (
                      <Button
                        key={route.userId}
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setBusyActionId(route.userId);
                          void Promise.resolve(router.push(route.href)).catch(
                            () => {
                              setBusyActionId(null);
                              toast.error("Couldn't open that recent editor", {
                                description:
                                  "Try the primary resume button or the search form above.",
                              });
                            },
                          );
                        }}
                        disabled={busyActionId !== null}
                        className="
                          min-h-10 border border-gold/15 bg-background/65 px-3 text-xs
                          tracking-[0.15em] uppercase
                          hover:bg-gold/5
                        "
                      >
                        {getRememberedUserPageRouteLabel(route)}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <SearchLaunchChooser
              discoveryContext={
                continuityState.lastDiscoveryContext ?? undefined
              }
              fallbackLabel="Focus search form"
              searchFallbackBehavior="focus-search"
              showDiscoveryHint={false}
            />

            <Button
              asChild
              type="button"
              variant="outline"
              size="sm"
              className="
                min-h-11 border-gold/20 bg-background/70 px-4 text-xs tracking-[0.15em] uppercase
                hover:bg-gold/5
              "
            >
              <Link href={examplesHref}>{examplesLabel}</Link>
            </Button>
          </div>
        </motion.div>

        <div className="grid gap-4 sm:grid-cols-3">
          {EDITOR_STARTER_STYLES.map((starterStyle, i) => (
            <motion.div
              key={starterStyle.id}
              initial={prefersReducedMotion ? false : "hidden"}
              whileInView={prefersReducedMotion ? undefined : "visible"}
              viewport={{ once: true, margin: "-50px" }}
              variants={{
                hidden: { opacity: 0, y: 40, scale: 0.96 },
                visible: {
                  opacity: 1,
                  y: 0,
                  scale: 1,
                  transition: {
                    duration: 0.55,
                    delay: i * 0.08,
                    ease: EASE_OUT_EXPO,
                  },
                },
              }}
              className="
                group relative border-2 border-gold/10 bg-gold/2 p-5 transition-colors duration-500
                hover:border-gold/30
              "
            >
              <div className="absolute inset-x-0 top-0 h-0.5 overflow-hidden">
                <motion.div
                  className="h-full bg-linear-to-r from-transparent via-gold to-transparent"
                  initial={prefersReducedMotion ? false : { x: "-100%" }}
                  whileInView={prefersReducedMotion ? undefined : { x: "0%" }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.75, delay: 0.2 + i * 0.08 }}
                />
              </div>

              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[0.68rem] tracking-[0.25em] text-gold/70 uppercase">
                    Starter look
                  </p>
                  <h3 className="
                    mt-2 font-display text-sm tracking-[0.22em] text-foreground uppercase
                  ">
                    {starterStyle.name}
                  </h3>
                </div>

                <div className="
                  flex size-10 items-center justify-center border border-gold/20 bg-gold/6
                ">
                  <Sparkles className="size-4 text-gold/75" />
                </div>
              </div>

              <div className="gold-line my-4 max-w-10" />

              <p className="font-body-serif text-sm/relaxed text-foreground/50">
                {starterStyle.description}
              </p>

              <p className="mt-4 text-xs/relaxed text-foreground/38">
                Queues into the same reusable template library the editor uses,
                so you can relaunch the look later instead of rebuilding it.
              </p>

              <Button
                type="button"
                size="sm"
                onClick={() => handleQueueStarterStyle(starterStyle)}
                disabled={busyActionId !== null}
                className="
                  mt-5 imperial-btn min-h-11 w-full imperial-btn-fill px-4 text-xs tracking-[0.15em]
                  uppercase
                "
              >
                {busyActionId === starterStyle.id ? (
                  <>
                    <Loader2
                      className="mr-2 size-4 animate-spin"
                      aria-hidden="true"
                    />
                    Opening editor…
                  </>
                ) : (
                  <>
                    Queue {starterStyle.name}
                    <ArrowRight className="ml-2 size-4" aria-hidden="true" />
                  </>
                )}
              </Button>

              <p className="mt-3 text-[0.68rem] tracking-[0.18em] text-foreground/32 uppercase">
                {hasLastEditor
                  ? "Reopens your last editor immediately"
                  : "Ready for the next search result"}
              </p>
            </motion.div>
          ))}
        </div>
      </div>

      <motion.p
        initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
        whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5, delay: 0.12 }}
        className="
          mx-auto mt-8 max-w-3xl text-center font-body-serif text-sm/relaxed text-foreground/42
          sm:text-base/relaxed
        "
      >
        Want even more elaborate launch presets? The live examples gallery can
        still queue full looks into the same template pipeline — no alternate
        editor shell, no duplicate setup flow, no chaos goblins.
      </motion.p>
    </section>
  );
}
