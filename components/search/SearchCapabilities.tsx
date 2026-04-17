"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Loader2, Search, Sparkles, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/Button";
import { EASE_OUT_EXPO } from "@/lib/animations";
import type { SettingsTemplateV1 } from "@/lib/user-page-settings-io";
import {
  queueSettingsTemplateForEditor,
  readSearchLaunchContinuityState,
  type SearchLaunchContinuityState,
  subscribeSearchLaunchContinuity,
} from "@/lib/user-page-settings-templates";
import {
  EDITOR_STARTER_STYLES,
  type EditorStarterStyle,
} from "@/lib/user-page-starters";

const EMPTY_CONTINUITY_STATE: SearchLaunchContinuityState = {
  pendingTemplateApply: null,
  lastSuccessfulUserRoute: null,
};

function getRememberedUserRouteTitle(
  route: SearchLaunchContinuityState["lastSuccessfulUserRoute"],
): string {
  if (!route) {
    return "Your last editor shows up here";
  }

  return route.username ? `@${route.username}` : `AniList user ${route.userId}`;
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
): string {
  if (pendingTemplateName) {
    return `${pendingTemplateName} is already queued and will apply the moment the editor opens.`;
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

  const handleResumeLastEditor = useCallback(() => {
    const href = continuityState.lastSuccessfulUserRoute?.href;
    if (!href) {
      focusSearchForm(prefersReducedMotion);
      return;
    }

    setBusyActionId("resume-last-editor");
    void Promise.resolve(router.push(href)).catch(() => {
      setBusyActionId(null);
      toast.error("Couldn't reopen the last editor", {
        description: "Try the search form above instead.",
      });
    });
  }, [
    continuityState.lastSuccessfulUserRoute?.href,
    prefersReducedMotion,
    router,
  ]);

  const handleQueueStarterStyle = useCallback(
    (starterStyle: EditorStarterStyle) => {
      const queueResult = queueSettingsTemplateForEditor(
        buildStarterStyleTemplate(starterStyle),
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
    [continuityState.lastSuccessfulUserRoute, prefersReducedMotion, router],
  );

  const hasLastEditor = Boolean(continuityState.lastSuccessfulUserRoute?.href);
  const pendingTemplateName =
    continuityState.pendingTemplateApply?.templateName;
  const queuedStyleMessage = getQueuedStyleMessage(pendingTemplateName);
  const resumeLastEditorButtonContent = renderResumeLastEditorButtonContent({
    hasLastEditor,
    isBusy: busyActionId === "resume-last-editor",
  });

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

              <p className="mt-3 text-xs/relaxed text-foreground/45">
                {queuedStyleMessage}
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
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
              {resumeLastEditorButtonContent}
            </Button>

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
              <Link href="/examples">Browse live examples</Link>
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
