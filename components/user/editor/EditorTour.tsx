"use client";

import { driver, type DriveStep } from "driver.js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { event, safeTrack } from "@/lib/utils/google-analytics";

import { shouldAutoStartTour } from "./tour-utils";

const TOUR_STORAGE_VERSION = "v1";

// Fallbacks for Driver.js tour step targets.
// Some tour UI only renders when a card is enabled (or when a group is expanded).
// Rather than dropping steps (which changes the tour length/order), fall back to a
// stable container or show the step as a centered popover.
const TOUR_SELECTOR_FALLBACKS: Readonly<Record<string, string[]>> = {
  '[data-tour="card-tile"]': ['[data-tour="card-groups"]'],
  '[data-tour="card-enable-toggle"]': [
    '[data-tour="card-tile"]',
    '[data-tour="card-groups"]',
  ],
  '[data-tour="card-settings"]': [
    '[data-tour="card-enable-toggle"]',
    '[data-tour="card-tile"]',
    '[data-tour="card-groups"]',
  ],
  '[data-tour="card-variant"]': [
    '[data-tour="card-settings"]',
    '[data-tour="card-tile"]',
    '[data-tour="card-groups"]',
  ],
  '[data-tour="card-preview"]': [
    '[data-tour="card-tile"]',
    '[data-tour="card-groups"]',
  ],
  '[data-tour="card-expand"]': [
    '[data-tour="card-preview"]',
    '[data-tour="card-tile"]',
    '[data-tour="card-groups"]',
  ],
};

function toPopoverOnlyStep(step: DriveStep): DriveStep {
  const { element: _element, ...rest } = step;
  return rest;
}

function resolveTourSelector(selector: string, doc: Document): Element | null {
  const direct = doc.querySelector(selector);
  if (direct) return direct;

  const fallbacks = TOUR_SELECTOR_FALLBACKS[selector];
  if (!fallbacks?.length) return null;

  for (const fallback of fallbacks) {
    const el = doc.querySelector(fallback);
    if (el) return el;
  }

  return null;
}

function resolveTourStepForDriver(step: DriveStep, doc: Document): DriveStep {
  if (!step.element) return step;

  if (typeof step.element === "string") {
    const el = resolveTourSelector(step.element, doc);
    return el ? { ...step, element: el } : toPopoverOnlyStep(step);
  }

  return step;
}

function normalizeToId(input?: string): string | undefined {
  if (!input) return undefined;
  return input
    .toLowerCase()
    .trim()
    .replaceAll('"', "")
    .replaceAll("'", "")
    .replaceAll("`", "")
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/(^-|-$)/g, "");
}

function ensureStepIds(steps: DriveStep[]): (DriveStep & { id: string })[] {
  return steps.map((step, idx) => {
    const s = { ...step } as DriveStep & { id?: string };

    if (s.id && typeof s.id === "string" && s.id.trim()) {
      return s as DriveStep & { id: string };
    }

    const titleId = normalizeToId(s.popover?.title);
    if (titleId) {
      s.id = titleId;
      return s as DriveStep & { id: string };
    }

    if (typeof s.element === "string" && s.element.trim()) {
      s.id = normalizeToId(s.element) ?? `step-${idx + 1}`;
      return s as DriveStep & { id: string };
    }

    s.id = `step-${idx + 1}`;
    return s as DriveStep & { id: string };
  });
}

function resolveTourStepsForDriver(
  steps: DriveStep[],
  doc: Document,
): DriveStep[] {
  const resolved = steps.map((step) => resolveTourStepForDriver(step, doc));
  return ensureStepIds(resolved);
}

/**
 * Find the index of the active step in a list of resolved driver steps.
 * Prefers stable `id` equality when available and falls back to
 * element + title matching for backward compatibility with older driver instances.
 */
export function findActiveStepIndex(
  resolvedSteps: DriveStep[],
  activeStep?: DriveStep | undefined,
): number {
  if (!activeStep) return -1;

  return resolvedSteps.findIndex((step) => {
    const stepId = (step as DriveStep & { id?: string }).id;
    const activeId =
      (activeStep as DriveStep & { id?: string }).id ??
      normalizeToId(activeStep.popover?.title);

    if (stepId && activeId) {
      return stepId === activeId;
    }

    // Fallback to legacy comparison if ids aren't available
    return (
      step.element === activeStep.element &&
      step.popover?.title === activeStep.popover?.title
    );
  });
}

type UseEditorTourArgs = Readonly<{
  userId: string | null;
  isNewUser: boolean;
  setIsNewUser: (next: boolean) => void;
  closeHelpDialog: () => void;
}>;

export function useEditorTour({
  userId,
  isNewUser,
  setIsNewUser,
  closeHelpDialog,
}: UseEditorTourArgs) {
  const tourStorageKey = useMemo(() => {
    if (!userId) return null;
    return `anicards:user-editor-tour:${TOUR_STORAGE_VERSION}:${userId}`;
  }, [userId]);

  const [isTourRunning, setIsTourRunning] = useState(false);
  const [isTourCompleted, setIsTourCompleted] = useState(false);
  const [lastDismissedAt, setLastDismissedAt] = useState<number | null>(null);
  const tourRef = useRef<ReturnType<typeof driver> | null>(null);
  const startTourTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const tourSteps = useMemo<DriveStep[]>(
    () => [
      {
        id: "welcome",
        popover: {
          title: "Welcome",
          description:
            "This quick tour highlights the key controls for enabling, styling, and sharing your cards.",
          side: "bottom",
          align: "center",
        },
      },
      {
        id: "help",
        element: '[data-tour="help-button"]',
        popover: {
          title: "Help",
          description:
            "Open Help anytime for searchable docs, shortcuts, and to restart this tour.",
          side: "bottom",
          align: "start",
        },
      },
      {
        id: "search",
        element: '[data-tour="card-search"]',
        popover: {
          title: "Search",
          description:
            "Search cards by name. Tip: Ctrl/Cmd+F focuses this input from anywhere.",
          side: "bottom",
          align: "start",
        },
      },
      {
        id: "visibility",
        element: '[data-tour="visibility-toggle"]',
        popover: {
          title: "Visibility",
          description:
            "Switch between All, Enabled, and Disabled cards to focus on what you need.",
          side: "top",
          align: "start",
        },
      },
      {
        id: "global-settings",
        element: '[data-tour="global-settings"]',
        popover: {
          title: "Global Settings",
          description:
            "Set your default style (colors, borders, and more). Cards can still be customized individually.",
          side: "bottom",
          align: "start",
        },
      },
      {
        id: "reorder",
        element: '[data-tour="reorder-toggle"]',
        popover: {
          title: "Reorder",
          description:
            "Turn on Reorder mode to drag cards within each category using the grip handle.",
          side: "top",
          align: "start",
        },
      },
      {
        id: "cards",
        element: '[data-tour="card-groups"]',
        popover: {
          title: "Cards",
          description:
            "Toggle cards on/off and open each card to configure variations and actions.",
          side: "top",
          align: "start",
        },
      },
      {
        id: "card-tiles",
        element: '[data-tour="card-tile"]',
        popover: {
          title: "Card tiles",
          description:
            "Each tile is one card. You can enable it, customize settings, and use the preview actions to share or download.",
          side: "top",
          align: "start",
        },
      },
      {
        id: "enable-card",
        element: '[data-tour="card-enable-toggle"]',
        popover: {
          title: "Enable a card",
          description:
            "Flip the switch to enable a card. When enabled, you'll get more controls like card settings, variants, and preview actions.",
          side: "top",
          align: "start",
        },
      },
      {
        id: "card-settings",
        element: '[data-tour="card-settings"]',
        popover: {
          title: "Card settings",
          description:
            "Fine-tune a specific card (override colors, borders, advanced options, etc.).",
          side: "bottom",
          align: "start",
        },
      },
      {
        id: "variants",
        element: '[data-tour="card-variant"]',
        popover: {
          title: "Variants",
          description:
            "Some cards support multiple layouts (variants). Choose the one you prefer here.",
          side: "top",
          align: "start",
        },
      },
      {
        id: "preview-actions",
        element: '[data-tour="card-preview"]',
        popover: {
          title: "Preview actions",
          description:
            "Hover (desktop) or tap the ⋯ actions button (mobile) to reveal actions like Open, Refresh, Copy, and Download.",
          side: "top",
          align: "start",
        },
      },
      {
        id: "expand-preview",
        element: '[data-tour="card-expand"]',
        popover: {
          title: "Expand preview",
          description:
            "Open a larger preview to inspect details (and access any extra preview-only actions).",
          side: "top",
          align: "start",
        },
      },
      {
        id: "save",
        element: '[data-tour="save-button"]',
        popover: {
          title: "Save",
          description:
            "Autosave runs automatically, but you can always save manually (Ctrl/Cmd+S).",
          side: "bottom",
          align: "start",
        },
      },
    ],
    [],
  );

  useEffect(() => {
    if (!tourStorageKey) return;

    try {
      setIsTourCompleted(
        globalThis.localStorage.getItem(tourStorageKey) === "1",
      );

      const dismissedRaw = globalThis.localStorage.getItem(
        `${tourStorageKey}:dismissed`,
      );
      const parsed = dismissedRaw ? Number(dismissedRaw) : Number.NaN;
      setLastDismissedAt(Number.isFinite(parsed) ? parsed : null);
    } catch {
      setIsTourCompleted(false);
      setLastDismissedAt(null);
    }
  }, [tourStorageKey]);

  const markTourCompleted = useCallback(() => {
    if (!tourStorageKey) return;
    try {
      globalThis.localStorage.setItem(tourStorageKey, "1");
    } catch {
      // Ignore storage failures (private mode / disabled storage)
    }
    setIsTourCompleted(true);
  }, [tourStorageKey]);

  const markTourDismissed = useCallback((): number | null => {
    if (!tourStorageKey) return null;
    try {
      // Record a dismissal timestamp separately so it can be distinguished from a full completion.
      // Purpose: store the time the user dismissed the tour so we can include it in analytics
      // and avoid re-showing the tour automatically for a reasonable cooldown period.
      const ts = Date.now();
      globalThis.localStorage.setItem(
        `${tourStorageKey}:dismissed`,
        String(ts),
      );
      setLastDismissedAt(ts);
      return ts;
    } catch {
      // Ignore storage failures (private mode / disabled storage)
      return null;
    }
  }, [tourStorageKey]);

  const trackEditorTourEvent = useCallback(
    (type: "completed" | "dismissed", timestamp?: number) => {
      safeTrack(() =>
        event({
          action: `editor_tour_${type}`,
          category: "engagement",
          // If a dismissal timestamp is available, send it as the event label for richer analytics.
          label: timestamp == null ? "editor_tour" : String(timestamp),
        }),
      );
    },
    [],
  );

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const startTour = useCallback(() => {
    closeHelpDialog();

    tourRef.current?.destroy();
    tourRef.current = null;

    if (startTourTimerRef.current != null) {
      globalThis.clearTimeout(startTourTimerRef.current);
      startTourTimerRef.current = null;
    }

    // Delay by one tick so dialogs/menus can close before the tour overlay mounts.
    startTourTimerRef.current = globalThis.setTimeout(() => {
      startTourTimerRef.current = null;

      if (!isMountedRef.current) return;
      if (!globalThis.document?.body) return;

      // Resolve selectors to elements so missing targets don't break the tour.
      // If a target is missing (e.g., card-only controls while all cards are disabled),
      // fall back to a stable container or show the step as a centered popover.
      const resolvedSteps = resolveTourStepsForDriver(
        tourSteps,
        globalThis.document,
      );

      if (resolvedSteps.length === 0) return;

      setIsTourRunning(true);

      try {
        const driverObj = driver({
          showProgress: true,
          showButtons: ["next", "previous", "close"],
          nextBtnText: "Next",
          prevBtnText: "Back",
          doneBtnText: "Done",
          smoothScroll: true,
          stagePadding: 8,
          stageRadius: 10,
          overlayOpacity: 0.6,
          steps: resolvedSteps,
          onDestroyed: (_el?: Element | undefined, activeStep?: DriveStep) => {
            setIsTourRunning(false);
            tourRef.current = null;

            // Determine whether the tour ended on the final step by checking if the
            // active step's index matches the last step index. This is more reliable
            // than reference equality which depends on driver.js implementation details.
            const activeIndex = findActiveStepIndex(resolvedSteps, activeStep);
            const isFinalStep =
              activeIndex !== -1 && activeIndex === resolvedSteps.length - 1;

            if (isFinalStep) {
              // Consider the tour completed only when the user finished the last step.
              markTourCompleted();
              trackEditorTourEvent("completed");
            } else {
              // Record a dismissal separately so we can differentiate it from a full completion.
              const dismissedAt = markTourDismissed();
              trackEditorTourEvent("dismissed", dismissedAt ?? undefined);
            }

            // Once the tour is done (completed or dismissed), hide the new-user callouts.
            setIsNewUser(false);
          },
        });

        tourRef.current = driverObj;
        driverObj.drive();
      } catch (err) {
        console.error("Failed to start guided tour:", err);
        setIsTourRunning(false);
        tourRef.current = null;
      }
    }, 0);
  }, [
    closeHelpDialog,
    markTourCompleted,
    markTourDismissed,
    trackEditorTourEvent,
    setIsNewUser,
    tourSteps,
  ]);

  useEffect(() => {
    return () => {
      if (startTourTimerRef.current != null) {
        globalThis.clearTimeout(startTourTimerRef.current);
        startTourTimerRef.current = null;
      }
      tourRef.current?.destroy();
      tourRef.current = null;
    };
  }, []);

  // Auto-run the tour for new users once per userId (versioned).
  useEffect(() => {
    if (!userId) return;

    if (
      !shouldAutoStartTour({
        isNewUser,
        isTourCompleted,
        isTourRunning,
        lastDismissedAt,
      })
    )
      return;

    // Delay tour start to allow initial UI render/layout to settle
    const timer = globalThis.setTimeout(() => {
      startTour();
    }, 500);

    return () => globalThis.clearTimeout(timer);
  }, [
    isNewUser,
    isTourCompleted,
    isTourRunning,
    startTour,
    userId,
    lastDismissedAt,
  ]);

  return {
    startTour,
    isTourRunning,
    isTourCompleted,
  };
}
