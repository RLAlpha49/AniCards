// useCardAutoSave.ts
//
// Coordinates debounced persistence for the user-page editor store.
// This hook saves only the local diff, so manual saves, auto-saves, draft restore,
// and conflict recovery all operate on the same patch shape.
//
// Keeping the save boundary here avoids duplicating timing, toast, and conflict logic
// across components that only need to know whether the editor is dirty or saving.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";

import { colorPresets } from "@/components/stat-card-generator/constants";
import type { ServerCardData } from "@/lib/api/cards";
import {
  isClientRequestCancelled,
  isClientTimeoutError,
  requestClientJson,
} from "@/lib/api/client-fetch";
import { statCardTypes } from "@/lib/card-types";
import {
  buildLocalEditsPatch,
  type CardEditorConfig,
  useUserPageEditor,
} from "@/lib/stores/user-page-editor";
import type { ColorValue } from "@/lib/types/card";
import {
  getResponseErrorMessage,
  getStructuredResponseError,
} from "@/lib/utils";

// Fast enough to feel responsive, slow enough to avoid POSTing on every edit.
const DEFAULT_DEBOUNCE_MS = 1500;
const AUTO_SAVE_REQUEST_TIMEOUT_MS = 15_000;
const AUTO_SAVE_TOTAL_RETRY_BUDGET_MS = 20_000;
const AUTO_SAVE_MAX_RETRY_ATTEMPTS = 3;
const AUTO_SAVE_RETRY_BASE_DELAY_MS = 500;
const AUTO_SAVE_RETRY_MAX_BACKOFF_MS = 5_000;

interface GlobalSettingsPayload {
  colorPreset: string;
  titleColor?: ColorValue;
  backgroundColor?: ColorValue;
  textColor?: ColorValue;
  circleColor?: ColorValue;
  borderEnabled: boolean;
  borderColor: string;
  borderRadius?: number;
  useStatusColors?: boolean;
  showPiePercentages?: boolean;
  showFavorites?: boolean;
  gridCols?: number;
  gridRows?: number;
}

type SaveCardsResponse =
  | { success: true; updatedAt: string }
  | { error: string }
  | { conflict: true; error: string; currentUpdatedAt?: string };

type SaveConflictInfo = {
  currentUpdatedAt?: string;
};

type SaveRetryPlan =
  | { shouldRetry: false }
  | { shouldRetry: true; delayMs: number };

type ActiveSaveRequest = {
  requestId: number;
  userId: string;
  controller: AbortController;
};

/**
 * Normalize a colors array to ensure it contains at least four values.
 * Pads with the default preset colors where necessary.
 */
function ensureFourColors(colors?: ColorValue[]): ColorValue[] {
  const defaultColors = colorPresets.default.colors;
  if (!Array.isArray(colors) || colors.length === 0) return [...defaultColors];
  if (colors.length >= 4) return colors.slice(0, 4);
  const out = colors.slice();
  for (let i = out.length; i < 4; i++) {
    out.push(defaultColors[i]);
  }
  return out;
}

function getCardConfigsInSaveOrder(opts: {
  cardConfigs: Record<string, CardEditorConfig>;
  cardOrder?: readonly string[];
  allowedIds: ReadonlySet<string>;
  fallbackOrder: readonly string[];
}): CardEditorConfig[] {
  const orderedIds =
    Array.isArray(opts.cardOrder) && opts.cardOrder.length > 0
      ? opts.cardOrder
      : opts.fallbackOrder;

  const configs: CardEditorConfig[] = [];
  const seen = new Set<string>();

  for (const id of orderedIds) {
    const cfg = opts.cardConfigs[id];
    if (!cfg) continue;
    if (!opts.allowedIds.has(cfg.cardId)) continue;
    configs.push(cfg);
    seen.add(cfg.cardId);
  }

  for (const cfg of Object.values(opts.cardConfigs)) {
    if (!opts.allowedIds.has(cfg.cardId)) continue;
    if (seen.has(cfg.cardId)) continue;
    configs.push(cfg);
  }

  return configs;
}

function buildCardPayloadsFromConfigs(opts: {
  configs: readonly CardEditorConfig[];
  globalColorPreset: string;
  normalizedGlobalColors: ColorValue[];
}): ServerCardData[] {
  const buildOne = (config: CardEditorConfig): ServerCardData => {
    const useCustomSettings = config.colorOverride.useCustomSettings;
    const baseCardId = (config.cardId || "").split("-")[0] || "";
    const isFavoritesGrid = baseCardId === "favoritesGrid";

    const base: ServerCardData = {
      cardName: config.cardId,
      variation: config.variant,
      useCustomSettings,
      ...(config.enabled ? {} : { disabled: true }),
    };

    if (!useCustomSettings) {
      return base;
    }

    const preset = config.colorOverride.colorPreset || "custom";
    base.colorPreset = preset;

    const shouldSendColors = !preset || preset === "custom";
    if (shouldSendColors) {
      const colors = Array.isArray(config.colorOverride.colors)
        ? ensureFourColors(config.colorOverride.colors)
        : opts.normalizedGlobalColors;
      base.titleColor = colors[0];
      base.backgroundColor = colors[1];
      base.textColor = colors[2];
      base.circleColor = colors[3];
    }

    base.borderColor = config.borderColor;
    base.borderRadius = config.borderRadius;
    base.useStatusColors = config.advancedSettings.useStatusColors;
    base.showPiePercentages = config.advancedSettings.showPiePercentages;
    base.showFavorites = config.advancedSettings.showFavorites;

    if (isFavoritesGrid) {
      base.gridCols = config.advancedSettings.gridCols;
      base.gridRows = config.advancedSettings.gridRows;
    }

    return base;
  };

  return opts.configs.map(buildOne);
}

function buildGlobalPayloadFromSnapshot(snapshot: {
  colorPreset: string;
  colors: readonly ColorValue[];
  borderEnabled: boolean;
  borderColor: string;
  borderRadius: number;
  advancedSettings?: {
    useStatusColors?: boolean;
    showPiePercentages?: boolean;
    showFavorites?: boolean;
    gridCols?: number;
    gridRows?: number;
  };
}): GlobalSettingsPayload {
  const shouldSendGlobalColors =
    !snapshot.colorPreset || snapshot.colorPreset === "custom";
  const normalizedGlobalColors = ensureFourColors(
    snapshot.colors as ColorValue[],
  );

  return {
    colorPreset: snapshot.colorPreset,
    titleColor: shouldSendGlobalColors ? normalizedGlobalColors[0] : undefined,
    backgroundColor: shouldSendGlobalColors
      ? normalizedGlobalColors[1]
      : undefined,
    textColor: shouldSendGlobalColors ? normalizedGlobalColors[2] : undefined,
    circleColor: shouldSendGlobalColors ? normalizedGlobalColors[3] : undefined,
    borderEnabled: snapshot.borderEnabled,
    borderColor: snapshot.borderColor,
    borderRadius: snapshot.borderEnabled ? snapshot.borderRadius : undefined,
    useStatusColors: snapshot.advancedSettings?.useStatusColors,
    showPiePercentages: snapshot.advancedSettings?.showPiePercentages,
    showFavorites: snapshot.advancedSettings?.showFavorites,
    gridCols: snapshot.advancedSettings?.gridCols,
    gridRows: snapshot.advancedSettings?.gridRows,
  };
}

function diffGlobalSettingsPayload(
  baseline: GlobalSettingsPayload | undefined,
  current: GlobalSettingsPayload,
): Partial<GlobalSettingsPayload> {
  if (!baseline) return current;

  const normalizeColor = (value: unknown): string | undefined => {
    if (value === undefined) return undefined;
    if (typeof value === "string") return value;
    try {
      return JSON.stringify(value);
    } catch {
      // Stable fallback when values cannot be serialized (e.g., cyclic objects).
      return "[unserializable]";
    }
  };

  const colorKeys = new Set([
    "titleColor",
    "backgroundColor",
    "textColor",
    "circleColor",
  ] as const);

  const diff: Partial<GlobalSettingsPayload> = {};
  const keys: Array<keyof GlobalSettingsPayload> = [
    "colorPreset",
    "titleColor",
    "backgroundColor",
    "textColor",
    "circleColor",
    "borderEnabled",
    "borderColor",
    "borderRadius",
    "useStatusColors",
    "showPiePercentages",
    "showFavorites",
    "gridCols",
    "gridRows",
  ];

  for (const key of keys) {
    const a = baseline[key];
    const b = current[key];
    if (
      colorKeys.has(key as typeof colorKeys extends Set<infer T> ? T : never)
    ) {
      const an = normalizeColor(a);
      const bn = normalizeColor(b);
      if (an !== bn) (diff as Record<string, unknown>)[key] = b as unknown;
      continue;
    }

    if (a !== b) {
      (diff as Record<string, unknown>)[key] = b as unknown;
    }
  }

  return diff;
}

function getPayloadField(
  payload: unknown,
  field: "currentUpdatedAt" | "updatedAt",
): string | undefined {
  if (typeof payload !== "object" || payload === null) {
    return undefined;
  }

  const value = (payload as Record<string, unknown>)[field];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function buildSaveCardsRequestBody(
  userId: string,
  cards: ServerCardData[],
  opts: {
    globalSettings?: Partial<GlobalSettingsPayload>;
    cardOrder?: string[];
    ifMatchUpdatedAt?: string;
  },
): Record<string, unknown> {
  return {
    userId,
    cards,
    ...(opts.globalSettings ? { globalSettings: opts.globalSettings } : {}),
    ...(Array.isArray(opts.cardOrder) ? { cardOrder: opts.cardOrder } : {}),
    ...(typeof opts.ifMatchUpdatedAt === "string" &&
    opts.ifMatchUpdatedAt.length > 0
      ? { ifMatchUpdatedAt: opts.ifMatchUpdatedAt }
      : {}),
  };
}

function queueExitSaveBeacon(payload: {
  userId: string;
  cards: ServerCardData[];
  globalSettings?: Partial<GlobalSettingsPayload>;
  cardOrder?: string[];
  ifMatchUpdatedAt?: string;
}): boolean {
  const sendBeacon = globalThis.navigator?.sendBeacon;
  if (typeof sendBeacon !== "function") {
    return false;
  }

  const body = JSON.stringify(
    buildSaveCardsRequestBody(payload.userId, payload.cards, {
      globalSettings: payload.globalSettings,
      cardOrder: payload.cardOrder,
      ifMatchUpdatedAt: payload.ifMatchUpdatedAt,
    }),
  );

  const beaconBody =
    typeof Blob === "function"
      ? new Blob([body], { type: "application/json;charset=UTF-8" })
      : body;

  try {
    return sendBeacon.call(
      globalThis.navigator,
      "/api/store-cards",
      beaconBody,
    );
  } catch {
    return false;
  }
}

function parseSaveCardsResponse(
  response: Response,
  payload: unknown,
): SaveCardsResponse {
  if (response.status === 409) {
    return {
      conflict: true,
      error: getResponseErrorMessage(response, payload),
      currentUpdatedAt: getPayloadField(payload, "currentUpdatedAt"),
    };
  }

  if (!response.ok) {
    return { error: getResponseErrorMessage(response, payload) };
  }

  const updatedAt = getPayloadField(payload, "updatedAt");
  if (!updatedAt) {
    return { error: "Save succeeded but no updatedAt was returned" };
  }

  return { success: true, updatedAt };
}

function buildSaveCardsTransportErrorMessage(error: unknown): string {
  if (isClientTimeoutError(error)) {
    return "Saving your cards timed out. Please try again.";
  }

  return "Failed to save cards. Please check your connection and try again.";
}

function createSaveAbortError(message: string): DOMException {
  return new DOMException(message, "AbortError");
}

function getRetryAfterDelayMs(
  retryAfterHeader: string | null,
): number | undefined {
  if (!retryAfterHeader) {
    return undefined;
  }

  const asSeconds = Number(retryAfterHeader);
  if (Number.isFinite(asSeconds) && asSeconds >= 0) {
    return asSeconds * 1000;
  }

  const retryAt = Date.parse(retryAfterHeader);
  if (Number.isNaN(retryAt)) {
    return undefined;
  }

  return Math.max(0, retryAt - Date.now());
}

function computeSaveRetryDelayMs(options: {
  attempt: number;
  retryAfterMs?: number;
}): number {
  if (typeof options.retryAfterMs === "number") {
    return options.retryAfterMs;
  }

  return Math.min(
    AUTO_SAVE_RETRY_BASE_DELAY_MS * 2 ** Math.max(0, options.attempt - 1),
    AUTO_SAVE_RETRY_MAX_BACKOFF_MS,
  );
}

function getRemainingSaveRequestBudgetMs(
  requestStartedAt: number,
  totalBudgetMs: number,
): number {
  return Math.max(0, totalBudgetMs - (Date.now() - requestStartedAt));
}

function hasBudgetForSaveRetry(options: {
  requestStartedAt: number;
  totalBudgetMs: number;
  delayMs: number;
}): boolean {
  return (
    getRemainingSaveRequestBudgetMs(
      options.requestStartedAt,
      options.totalBudgetMs,
    ) > options.delayMs
  );
}

function isRetryableSaveTransportFailure(
  error: unknown,
  signal?: AbortSignal,
): boolean {
  if (isClientRequestCancelled(error, signal)) {
    return false;
  }

  if (isClientTimeoutError(error)) {
    return true;
  }

  return error instanceof TypeError;
}

async function waitForSaveRetryDelay(
  delayMs: number,
  signal?: AbortSignal,
): Promise<void> {
  if (delayMs <= 0) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const timeoutId = globalThis.setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, delayMs);

    const onAbort = () => {
      globalThis.clearTimeout(timeoutId);
      signal?.removeEventListener("abort", onAbort);
      reject(
        signal?.reason instanceof Error
          ? signal.reason
          : createSaveAbortError(
              "The card save request was cancelled during retry backoff.",
            ),
      );
    };

    if (signal) {
      if (signal.aborted) {
        onAbort();
        return;
      }

      signal.addEventListener("abort", onAbort, { once: true });
    }
  });
}

function buildSaveRetryPlan(options: {
  attempt: number;
  retryable: boolean;
  retryAfterMs?: number;
}): SaveRetryPlan {
  if (!options.retryable || options.attempt >= AUTO_SAVE_MAX_RETRY_ATTEMPTS) {
    return { shouldRetry: false };
  }

  return {
    shouldRetry: true,
    delayMs: computeSaveRetryDelayMs({
      attempt: options.attempt,
      retryAfterMs: options.retryAfterMs,
    }),
  };
}

function getSaveResponseRetryPlan(
  response: Response,
  payload: unknown,
  attempt: number,
): SaveRetryPlan {
  if (response.ok) {
    return { shouldRetry: false };
  }

  const structuredError = getStructuredResponseError(response, payload);
  const responseStatusIsRetryable =
    response.status === 429 || response.status >= 500;

  return buildSaveRetryPlan({
    attempt,
    retryable: responseStatusIsRetryable && structuredError.retryable,
    retryAfterMs: getRetryAfterDelayMs(response.headers.get("retry-after")),
  });
}

function getSaveTransportRetryPlan(
  error: unknown,
  attempt: number,
  signal?: AbortSignal,
): SaveRetryPlan {
  return buildSaveRetryPlan({
    attempt,
    retryable: isRetryableSaveTransportFailure(error, signal),
  });
}

async function waitForPlannedSaveRetry(options: {
  retryPlan: SaveRetryPlan;
  requestStartedAt: number;
  totalBudgetMs: number;
  signal?: AbortSignal;
}): Promise<boolean> {
  if (!options.retryPlan.shouldRetry) {
    return false;
  }

  if (
    !hasBudgetForSaveRetry({
      requestStartedAt: options.requestStartedAt,
      totalBudgetMs: options.totalBudgetMs,
      delayMs: options.retryPlan.delayMs,
    })
  ) {
    return false;
  }

  await waitForSaveRetryDelay(options.retryPlan.delayMs, options.signal);
  return true;
}

async function requestSaveCardsAttempt(options: {
  body: string;
  remainingBudgetMs: number;
  signal?: AbortSignal;
  timeoutMs: number;
}): Promise<{ response: Response; payload: unknown }> {
  return requestClientJson("/api/store-cards", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: options.body,
    signal: options.signal,
    timeoutMs: Math.min(options.timeoutMs, options.remainingBudgetMs),
  });
}

function cancelActiveSave(
  activeSaveRef: { current: ActiveSaveRequest | null },
  reason: string,
): boolean {
  if (!activeSaveRef.current) {
    return false;
  }

  activeSaveRef.current.controller.abort(createSaveAbortError(reason));
  activeSaveRef.current = null;
  return true;
}

function beginSaveAttempt(
  activeSaveRef: { current: ActiveSaveRequest | null },
  nextSaveRequestIdRef: { current: number },
  userId: string,
) {
  const controller = new AbortController();
  const requestId = nextSaveRequestIdRef.current + 1;
  nextSaveRequestIdRef.current = requestId;
  activeSaveRef.current = {
    requestId,
    userId,
    controller,
  };

  return {
    controller,
    requestId,
    isCurrentSave: () =>
      activeSaveRef.current?.requestId === requestId &&
      activeSaveRef.current?.controller === controller &&
      !controller.signal.aborted,
  };
}

function buildUnexpectedSaveFailureMessage(error: unknown): string {
  if (isClientTimeoutError(error)) {
    return "Saving your cards timed out. Please try again.";
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "Failed to save cards. Please check your connection and try again.";
}

function applySaveResult(params: {
  result: SaveCardsResponse;
  store: ReturnType<typeof useUserPageEditor.getState>;
  payloadPatch: NonNullable<ReturnType<typeof buildLocalEditsPatch>>;
  toastId: string;
  shouldNotify: boolean;
  setSaveConflict: (next: SaveConflictInfo | null) => void;
}): void {
  if ("conflict" in params.result) {
    params.store.setSaveError(params.result.error);
    if (params.shouldNotify) {
      params.setSaveConflict({
        currentUpdatedAt: params.result.currentUpdatedAt,
      });
      toast.error("Save conflict", {
        id: params.toastId,
        description:
          "Changes were saved in another tab. Reload to sync, then re-apply your edits.",
      });
    }
    return;
  }

  if ("error" in params.result) {
    params.store.setSaveError(params.result.error);
    if (params.shouldNotify) {
      toast.error("Save failed", {
        id: params.toastId,
        description: params.result.error,
      });
    }
    return;
  }

  params.store.markSaved({
    serverUpdatedAt: params.result.updatedAt,
    appliedPatch: params.payloadPatch,
  });
  if (params.shouldNotify) {
    params.setSaveConflict(null);
    toast.success("Saved", { id: params.toastId });
  }
}

async function saveCardsToApi(
  userId: string,
  cards: ServerCardData[],
  opts: {
    globalSettings?: Partial<GlobalSettingsPayload>;
    cardOrder?: string[];
    ifMatchUpdatedAt?: string;
  },
  requestOptions: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<SaveCardsResponse> {
  const body = JSON.stringify(buildSaveCardsRequestBody(userId, cards, opts));
  const timeoutMs = requestOptions.timeoutMs ?? AUTO_SAVE_REQUEST_TIMEOUT_MS;
  const totalRetryBudgetMs = Math.max(
    timeoutMs,
    AUTO_SAVE_TOTAL_RETRY_BUDGET_MS,
  );
  const requestStartedAt = Date.now();

  for (let attempt = 1; attempt <= AUTO_SAVE_MAX_RETRY_ATTEMPTS; attempt += 1) {
    const remainingBudgetMs = getRemainingSaveRequestBudgetMs(
      requestStartedAt,
      totalRetryBudgetMs,
    );
    if (remainingBudgetMs <= 0) {
      return {
        error: "Saving your cards timed out. Please try again.",
      };
    }

    try {
      const { response: res, payload } = await requestSaveCardsAttempt({
        body,
        remainingBudgetMs,
        signal: requestOptions.signal,
        timeoutMs,
      });

      if (
        await waitForPlannedSaveRetry({
          retryPlan: getSaveResponseRetryPlan(res, payload, attempt),
          requestStartedAt,
          totalBudgetMs: totalRetryBudgetMs,
          signal: requestOptions.signal,
        })
      ) {
        continue;
      }

      return parseSaveCardsResponse(res, payload);
    } catch (err) {
      if (isClientRequestCancelled(err, requestOptions.signal)) {
        throw err;
      }

      if (
        await waitForPlannedSaveRetry({
          retryPlan: getSaveTransportRetryPlan(
            err,
            attempt,
            requestOptions.signal,
          ),
          requestStartedAt,
          totalBudgetMs: totalRetryBudgetMs,
          signal: requestOptions.signal,
        })
      ) {
        continue;
      }

      console.error("Error saving cards:", err);
      return {
        error: buildSaveCardsTransportErrorMessage(err),
      };
    }
  }

  return {
    error: "Failed to save cards. Please check your connection and try again.",
  };
}

function buildSavePayloadFromStoreState(
  state: ReturnType<typeof useUserPageEditor.getState>,
): {
  userId: string;
  patch: NonNullable<ReturnType<typeof buildLocalEditsPatch>>;
  cards: ServerCardData[];
  globalSettings?: Partial<GlobalSettingsPayload>;
  cardOrder?: string[];
  ifMatchUpdatedAt?: string;
} | null {
  if (!state.userId) return null;
  const patch = buildLocalEditsPatch(state);
  if (!patch) return null;

  const allowedIds = new Set(statCardTypes.map((t) => t.id));
  const fallbackOrder = statCardTypes.map((t) => t.id);
  const normalizedGlobalColors = ensureFourColors(state.globalColors);

  const cardsConfigs = patch.cardConfigs ?? {};
  const configsArray = getCardConfigsInSaveOrder({
    cardConfigs: cardsConfigs,
    cardOrder: state.cardOrder,
    allowedIds,
    fallbackOrder,
  });

  const cards = buildCardPayloadsFromConfigs({
    configs: configsArray,
    globalColorPreset: state.globalColorPreset,
    normalizedGlobalColors,
  });

  let globalSettings: Partial<GlobalSettingsPayload> | undefined;
  if (patch.globalSnapshot) {
    const currentGlobal = buildGlobalPayloadFromSnapshot({
      colorPreset: patch.globalSnapshot.colorPreset,
      colors: patch.globalSnapshot.colors,
      borderEnabled: Boolean(patch.globalSnapshot.borderEnabled),
      borderColor: patch.globalSnapshot.borderColor,
      borderRadius: patch.globalSnapshot.borderRadius,
      advancedSettings: patch.globalSnapshot.advancedSettings,
    });
    const baselineGlobal = state.baselineGlobalSnapshot
      ? buildGlobalPayloadFromSnapshot({
          colorPreset: state.baselineGlobalSnapshot.colorPreset,
          colors: state.baselineGlobalSnapshot.colors,
          borderEnabled: Boolean(state.baselineGlobalSnapshot.borderEnabled),
          borderColor: state.baselineGlobalSnapshot.borderColor,
          borderRadius: state.baselineGlobalSnapshot.borderRadius,
          advancedSettings: state.baselineGlobalSnapshot.advancedSettings,
        })
      : undefined;

    globalSettings = diffGlobalSettingsPayload(baselineGlobal, currentGlobal);
    if (Object.keys(globalSettings).length === 0) {
      globalSettings = undefined;
    }
  }

  return {
    userId: state.userId,
    patch,
    cards,
    globalSettings,
    cardOrder: patch.cardOrder,
    ifMatchUpdatedAt: state.serverUpdatedAt ?? undefined,
  };
}

interface UseCardAutoSaveOptions {
  /** Debounce delay in milliseconds. Default: 1500ms */
  debounceMs?: number;
  /** Whether auto-save is enabled. Default: true */
  enabled?: boolean;
}

/**
 * Connects the editor store to the debounced `/api/store-cards` save flow.
 *
 * The hook returns save controls plus derived status so toolbar buttons and autosave
 * indicators can share one source of truth for manual saves, queued saves, and 409
 * conflict handling.
 */
export function useCardAutoSave(options: UseCardAutoSaveOptions = {}) {
  const { debounceMs = DEFAULT_DEBOUNCE_MS, enabled = true } = options;

  const { userId, isDirty, isSaving } = useUserPageEditor(
    useShallow((state) => ({
      userId: state.userId,
      isDirty: state.isDirty,
      isSaving: state.isSaving,
    })),
  );

  const [saveConflict, setSaveConflict] = useState<SaveConflictInfo | null>(
    null,
  );

  const [autoSaveDueAt, setAutoSaveDueAt] = useState<number | null>(null);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  const activeSaveRef = useRef<ActiveSaveRequest | null>(null);
  const nextSaveRequestIdRef = useRef(0);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      cancelActiveSave(
        activeSaveRef,
        "The card save request was cancelled during cleanup.",
      );
      useUserPageEditor.getState().setSaving(false);
    };
  }, []);

  useEffect(() => {
    const activeSave = activeSaveRef.current;

    if (!activeSave) {
      return;
    }

    if (userId && activeSave.userId === userId) {
      return;
    }

    cancelActiveSave(
      activeSaveRef,
      "The card save request was cancelled because the active user changed.",
    );
    useUserPageEditor.getState().setSaving(false);
  }, [userId]);

  const performSave = useCallback(
    async (opts?: { reason?: "auto" | "manual" }) => {
      if (saveConflict) {
        toast.error("Resolve save conflict", {
          description:
            "Reload the latest settings first, then re-apply your edits.",
        });
        return;
      }

      const { isSaving: alreadySaving } = useUserPageEditor.getState();
      if (alreadySaving) return;

      const snapshot = useUserPageEditor.getState();
      const payload = buildSavePayloadFromStoreState(snapshot);
      if (!payload || !isMountedRef.current) return;
      const store = useUserPageEditor.getState();
      const { controller, requestId, isCurrentSave } = beginSaveAttempt(
        activeSaveRef,
        nextSaveRequestIdRef,
        payload.userId,
      );

      setAutoSaveDueAt(null);
      store.setSaving(true);

      const toastId = "user-page-autosave";
      toast.loading(opts?.reason === "manual" ? "Saving…" : "Auto-saving…", {
        id: toastId,
      });

      try {
        const result = await saveCardsToApi(
          payload.userId,
          payload.cards,
          {
            globalSettings: payload.globalSettings,
            cardOrder: payload.cardOrder,
            ifMatchUpdatedAt: payload.ifMatchUpdatedAt,
          },
          {
            signal: controller.signal,
            timeoutMs: AUTO_SAVE_REQUEST_TIMEOUT_MS,
          },
        );

        if (!isCurrentSave()) {
          return;
        }

        if (useUserPageEditor.getState().userId !== payload.userId) {
          return;
        }

        applySaveResult({
          result,
          store,
          payloadPatch: payload.patch,
          toastId,
          shouldNotify: isMountedRef.current,
          setSaveConflict,
        });
      } catch (error) {
        if (
          isClientRequestCancelled(error, controller.signal) ||
          !isCurrentSave()
        ) {
          return;
        }

        const message = buildUnexpectedSaveFailureMessage(error);

        store.setSaveError(message);

        if (isMountedRef.current) {
          toast.error("Save failed", {
            id: toastId,
            description: message,
          });
        }
      } finally {
        if (activeSaveRef.current?.requestId === requestId) {
          activeSaveRef.current = null;
        }

        useUserPageEditor.getState().setSaving(false);
      }
    },
    [saveConflict],
  );

  const clearSaveConflict = useCallback(() => {
    setSaveConflict(null);
    useUserPageEditor.getState().setSaveError(null);
  }, []);

  useEffect(() => {
    if (!isDirty && saveConflict) {
      setSaveConflict(null);
    }
  }, [isDirty, saveConflict]);

  const saveNow = useCallback(async () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    setAutoSaveDueAt(null);

    await performSave({ reason: "manual" });
  }, [performSave]);

  const shouldQueueAutoSave =
    enabled && userId != null && isDirty && !isSaving && !saveConflict;

  useEffect(() => {
    if (!shouldQueueAutoSave) {
      setAutoSaveDueAt(null);
    }
  }, [shouldQueueAutoSave]);

  useEffect(() => {
    if (!shouldQueueAutoSave) {
      return;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    const dueAt = Date.now() + debounceMs;
    setAutoSaveDueAt(dueAt);

    timeoutRef.current = setTimeout(() => {
      performSave({ reason: "auto" });
    }, debounceMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [shouldQueueAutoSave, debounceMs, performSave]);

  useEffect(() => {
    if (!shouldQueueAutoSave) {
      return;
    }

    const handlePageHide = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      setAutoSaveDueAt(null);

      const payload = buildSavePayloadFromStoreState(
        useUserPageEditor.getState(),
      );
      if (!payload) {
        return;
      }

      queueExitSaveBeacon(payload);
    };

    globalThis.window.addEventListener("pagehide", handlePageHide);

    return () => {
      globalThis.window.removeEventListener("pagehide", handlePageHide);
    };
  }, [shouldQueueAutoSave]);

  return {
    /** Trigger an immediate save, bypassing debounce */
    saveNow,
    /** Clear a save-conflict state after reloading latest server data */
    clearSaveConflict,
    /** Whether a save operation is currently in progress */
    isSaving,
    /** Whether there are unsaved changes */
    isDirty,
    /** Whether an auto-save is queued (debounced) */
    isAutoSaveQueued: autoSaveDueAt !== null,
    /** When the current queued auto-save is expected to run */
    autoSaveDueAt,
    /** Present when a 409 conflict was detected and needs resolution */
    saveConflict,
  };
}
