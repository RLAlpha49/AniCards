import { normalizePositiveIntegerString } from "./api/primitives";
import { getUserProfilePath } from "./seo";
import type { SettingsTemplateV1 } from "./user-page-settings-io";
import {
  makeSettingsExport,
  parseSettingsExportJson,
} from "./user-page-settings-io";
import {
  buildNewUserStarterWorkspaceSeed,
  type NewUserStarterWorkspaceSeed,
} from "./user-page-starters";

export const SETTINGS_TEMPLATES_STORAGE_KEY =
  "anicards:user-page-settings-templates:v1";

export const PENDING_SETTINGS_TEMPLATE_APPLY_STORAGE_KEY =
  "anicards:user-page-settings-template-apply:v1";

export const LAST_SUCCESSFUL_USER_PAGE_ROUTE_STORAGE_KEY =
  "anicards:last-successful-user-page-route:v1";

export const RECENT_SUCCESSFUL_USER_PAGE_ROUTES_STORAGE_KEY =
  "anicards:recent-successful-user-page-routes:v1";

export const EXAMPLES_DISCOVERY_CONTEXT_STORAGE_KEY =
  "anicards:examples-discovery-context:v1";

type SearchLaunchSource = "examples" | "search-starter";
type ExamplesDiscoveryRouteKind = "index" | "gallery" | "collection" | "legacy";
type SearchLaunchDiscoveryContextLike =
  | SearchLaunchDiscoveryContextInput
  | SearchLaunchDiscoveryContext
  | null
  | undefined;

export interface SearchLaunchDiscoveryContext {
  source: "examples";
  href: string;
  routeKind: ExamplesDiscoveryRouteKind;
  collectionName?: string;
  collectionSlug?: string;
  searchQuery?: string;
  savedAt: number;
}

export type SearchLaunchDiscoveryContextInput = Omit<
  SearchLaunchDiscoveryContext,
  "savedAt"
>;

export interface PendingSettingsTemplateExampleContext {
  cardTypeId: string;
  cardTitle: string;
  variantName: string;
  themeLabel: string;
}

export interface PendingSettingsTemplateApply {
  templateId: string;
  templateName?: string;
  applyTo: "global";
  source: SearchLaunchSource;
  queuedAt: number;
  exampleContext?: PendingSettingsTemplateExampleContext;
  discoveryContext?: SearchLaunchDiscoveryContext;
  starterWorkspaceSeed?: NewUserStarterWorkspaceSeed;
}

export interface RememberedUserPageRoute {
  href: string;
  userId: string;
  username?: string;
  savedAt: number;
}

export interface SearchLaunchContinuityState {
  pendingTemplateApply: PendingSettingsTemplateApply | null;
  lastSuccessfulUserRoute: RememberedUserPageRoute | null;
  recentSuccessfulUserRoutes: RememberedUserPageRoute[];
  lastDiscoveryContext: SearchLaunchDiscoveryContext | null;
}

export interface QueueSettingsTemplateForEditorOptions {
  source?: PendingSettingsTemplateApply["source"];
  exampleContext?: PendingSettingsTemplateApply["exampleContext"];
  discoveryContext?: SearchLaunchDiscoveryContextInput | null;
  starterWorkspaceSeed?: NewUserStarterWorkspaceSeed | null;
}

export type SettingsTemplatesStorageResult =
  | { ok: true }
  | { ok: false; error: string };

const SETTINGS_TEMPLATES_STORAGE_ERROR =
  "Couldn't save template changes in this browser. Check storage permissions and try again.";

const CONTINUITY_STORAGE_AREAS = ["sessionStorage", "localStorage"] as const;
const MAX_RECENT_SUCCESSFUL_USER_PAGE_ROUTES = 4;

const SEARCH_LAUNCH_CONTINUITY_EVENT =
  "anicards:search-launch-continuity-change";

const SEARCH_LAUNCH_CONTINUITY_STORAGE_KEYS = [
  PENDING_SETTINGS_TEMPLATE_APPLY_STORAGE_KEY,
  LAST_SUCCESSFUL_USER_PAGE_ROUTE_STORAGE_KEY,
  RECENT_SUCCESSFUL_USER_PAGE_ROUTES_STORAGE_KEY,
  EXAMPLES_DISCOVERY_CONTEXT_STORAGE_KEY,
] as const;

function dispatchSearchLaunchContinuityChange(): void {
  if (globalThis.window === undefined) return;

  try {
    globalThis.window.dispatchEvent(new Event(SEARCH_LAUNCH_CONTINUITY_EVENT));
  } catch {
    // Ignore event dispatch failures.
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeNonBlankString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function getContinuityStorage(
  area: (typeof CONTINUITY_STORAGE_AREAS)[number],
): Storage | null {
  if (globalThis.window === undefined) {
    return null;
  }

  try {
    return globalThis.window[area];
  } catch {
    return null;
  }
}

function readContinuityStorageValue(key: string): string | null {
  for (const area of CONTINUITY_STORAGE_AREAS) {
    const storage = getContinuityStorage(area);

    if (!storage) {
      continue;
    }

    try {
      const raw = storage.getItem(key);

      if (raw) {
        return raw;
      }
    } catch {
      // Ignore storage read failures and keep falling back.
    }
  }

  return null;
}

function writeContinuityStorageValue(key: string, value: string): void {
  for (const area of CONTINUITY_STORAGE_AREAS) {
    const storage = getContinuityStorage(area);

    if (!storage) {
      continue;
    }

    try {
      storage.setItem(key, value);
    } catch {
      // Ignore per-storage write failures.
    }
  }
}

function removeContinuityStorageValue(key: string): void {
  for (const area of CONTINUITY_STORAGE_AREAS) {
    const storage = getContinuityStorage(area);

    if (!storage) {
      continue;
    }

    try {
      storage.removeItem(key);
    } catch {
      // Ignore per-storage removal failures.
    }
  }
}

function isSearchLaunchContinuityStorageKey(key: string | null): boolean {
  if (key === null) {
    return true;
  }

  return SEARCH_LAUNCH_CONTINUITY_STORAGE_KEYS.includes(
    key as (typeof SEARCH_LAUNCH_CONTINUITY_STORAGE_KEYS)[number],
  );
}

function parsePendingSettingsTemplateExampleContext(
  value: unknown,
): PendingSettingsTemplateExampleContext | undefined {
  if (!isPlainObject(value)) {
    return undefined;
  }

  const cardTypeId = normalizeNonBlankString(value.cardTypeId);
  const cardTitle = normalizeNonBlankString(value.cardTitle);
  const variantName = normalizeNonBlankString(value.variantName);
  const themeLabel = normalizeNonBlankString(value.themeLabel);

  if (!cardTypeId || !cardTitle || !variantName || !themeLabel) {
    return undefined;
  }

  return {
    cardTypeId,
    cardTitle,
    variantName,
    themeLabel,
  };
}

function isColorValueLike(value: unknown): boolean {
  return typeof value === "string" || isPlainObject(value);
}

function getOptionalFiniteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function getOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function getOptionalStarterColorValue<T>(value: unknown): T | undefined {
  return isColorValueLike(value) ? (value as T) : undefined;
}

function parseStoredStarterCardConfig(
  value: unknown,
): NewUserStarterWorkspaceSeed["cards"][number] | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const cardName = normalizeNonBlankString(value.cardName);

  if (!cardName) {
    return null;
  }

  return {
    cardName,
    variation: normalizeNonBlankString(value.variation),
    colorPreset: normalizeNonBlankString(value.colorPreset),
    titleColor: getOptionalStarterColorValue<
      NewUserStarterWorkspaceSeed["cards"][number]["titleColor"]
    >(value.titleColor),
    backgroundColor: getOptionalStarterColorValue<
      NewUserStarterWorkspaceSeed["cards"][number]["backgroundColor"]
    >(value.backgroundColor),
    textColor: getOptionalStarterColorValue<
      NewUserStarterWorkspaceSeed["cards"][number]["textColor"]
    >(value.textColor),
    circleColor: getOptionalStarterColorValue<
      NewUserStarterWorkspaceSeed["cards"][number]["circleColor"]
    >(value.circleColor),
    borderColor: normalizeNonBlankString(value.borderColor),
    borderRadius: getOptionalFiniteNumber(value.borderRadius),
    showFavorites: getOptionalBoolean(value.showFavorites),
    useStatusColors: getOptionalBoolean(value.useStatusColors),
    showPiePercentages: getOptionalBoolean(value.showPiePercentages),
    gridCols: getOptionalFiniteNumber(value.gridCols),
    gridRows: getOptionalFiniteNumber(value.gridRows),
    useCustomSettings: getOptionalBoolean(value.useCustomSettings),
    disabled: getOptionalBoolean(value.disabled),
  };
}

function parseStarterWorkspaceGlobalSettings(
  value: unknown,
): NewUserStarterWorkspaceSeed["globalSettings"] | null {
  if (!isPlainObject(value)) {
    return null;
  }

  return {
    colorPreset: normalizeNonBlankString(value.colorPreset),
    titleColor: getOptionalStarterColorValue<
      NewUserStarterWorkspaceSeed["globalSettings"]["titleColor"]
    >(value.titleColor),
    backgroundColor: getOptionalStarterColorValue<
      NewUserStarterWorkspaceSeed["globalSettings"]["backgroundColor"]
    >(value.backgroundColor),
    textColor: getOptionalStarterColorValue<
      NewUserStarterWorkspaceSeed["globalSettings"]["textColor"]
    >(value.textColor),
    circleColor: getOptionalStarterColorValue<
      NewUserStarterWorkspaceSeed["globalSettings"]["circleColor"]
    >(value.circleColor),
    borderEnabled: getOptionalBoolean(value.borderEnabled),
    borderColor: normalizeNonBlankString(value.borderColor),
    borderRadius: getOptionalFiniteNumber(value.borderRadius),
    useStatusColors: getOptionalBoolean(value.useStatusColors),
    showPiePercentages: getOptionalBoolean(value.showPiePercentages),
    showFavorites: getOptionalBoolean(value.showFavorites),
    gridCols: getOptionalFiniteNumber(value.gridCols),
    gridRows: getOptionalFiniteNumber(value.gridRows),
  };
}

function parseStarterWorkspaceSeed(
  value: unknown,
): NewUserStarterWorkspaceSeed | undefined {
  if (!isPlainObject(value) || !Array.isArray(value.cards)) {
    return undefined;
  }

  const cards = value.cards
    .map((entry) => parseStoredStarterCardConfig(entry))
    .filter(
      (entry): entry is NewUserStarterWorkspaceSeed["cards"][number] =>
        entry !== null,
    );

  if (cards.length !== value.cards.length) {
    return undefined;
  }

  const globalSettings = parseStarterWorkspaceGlobalSettings(
    value.globalSettings,
  );

  if (!globalSettings) {
    return undefined;
  }

  return {
    cards,
    globalSettings,
  };
}

function parseSearchLaunchDiscoveryContextValue(
  value: unknown,
): SearchLaunchDiscoveryContext | null {
  if (!isPlainObject(value) || value.source !== "examples") {
    return null;
  }

  const href = normalizeNonBlankString(value.href);
  const routeKind = value.routeKind;
  const savedAt = value.savedAt;

  if (
    !href ||
    !href.startsWith("/examples") ||
    (routeKind !== "index" &&
      routeKind !== "gallery" &&
      routeKind !== "collection" &&
      routeKind !== "legacy") ||
    typeof savedAt !== "number" ||
    !Number.isFinite(savedAt)
  ) {
    return null;
  }

  return {
    source: "examples",
    href,
    routeKind,
    collectionName: normalizeNonBlankString(value.collectionName),
    collectionSlug: normalizeNonBlankString(value.collectionSlug),
    searchQuery: normalizeNonBlankString(value.searchQuery),
    savedAt,
  };
}

function parseSearchLaunchDiscoveryContext(
  raw: string | null,
): SearchLaunchDiscoveryContext | null {
  if (!raw) {
    return null;
  }

  try {
    return parseSearchLaunchDiscoveryContextValue(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

function buildSearchLaunchDiscoveryContext(
  input: SearchLaunchDiscoveryContextLike,
  savedAt = Date.now(),
): SearchLaunchDiscoveryContext | null {
  if (!input) {
    return null;
  }

  const storedContext = parseSearchLaunchDiscoveryContextValue(input);

  if (storedContext) {
    return storedContext;
  }

  if (input.source !== "examples") {
    return null;
  }

  const href = normalizeNonBlankString(input.href);

  if (!href?.startsWith("/examples")) {
    return null;
  }

  return {
    source: "examples",
    href,
    routeKind: input.routeKind,
    collectionName: normalizeNonBlankString(input.collectionName),
    collectionSlug: normalizeNonBlankString(input.collectionSlug),
    searchQuery: normalizeNonBlankString(input.searchQuery),
    savedAt,
  };
}

function parsePendingSettingsTemplateApply(
  raw: string | null,
): PendingSettingsTemplateApply | null {
  if (!raw) return null;

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }

  if (!isPlainObject(parsed)) {
    return null;
  }

  const templateId = normalizeNonBlankString(parsed.templateId);

  if (!templateId || parsed.applyTo !== "global") {
    return null;
  }

  const source = parsed.source;

  if (source !== "examples" && source !== "search-starter") {
    return null;
  }

  if (
    typeof parsed.queuedAt !== "number" ||
    !Number.isFinite(parsed.queuedAt)
  ) {
    return null;
  }

  return {
    templateId,
    templateName: normalizeNonBlankString(parsed.templateName),
    applyTo: "global",
    source,
    queuedAt: parsed.queuedAt,
    exampleContext: parsePendingSettingsTemplateExampleContext(
      parsed.exampleContext,
    ),
    discoveryContext:
      parseSearchLaunchDiscoveryContextValue(parsed.discoveryContext) ??
      undefined,
    starterWorkspaceSeed: parseStarterWorkspaceSeed(
      parsed.starterWorkspaceSeed,
    ),
  };
}

function buildRememberedUserPageHref(params: {
  userId: string;
  username?: string | null;
}): string {
  const normalizedUsername = params.username?.trim();
  if (normalizedUsername) {
    return getUserProfilePath(normalizedUsername);
  }

  return `/user?${new URLSearchParams({ userId: params.userId }).toString()}`;
}

function parseRememberedUserPageRouteValue(
  value: unknown,
): RememberedUserPageRoute | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const userId = normalizePositiveIntegerString(
    typeof value.userId === "string" ? value.userId : null,
  );
  const href = typeof value.href === "string" ? value.href.trim() : "";
  const savedAt = value.savedAt;

  if (!userId || !href.startsWith("/user")) {
    return null;
  }

  if (typeof savedAt !== "number" || !Number.isFinite(savedAt)) {
    return null;
  }

  return {
    href,
    userId,
    username: normalizeNonBlankString(value.username),
    savedAt,
  };
}

function parseRememberedUserPageRoute(
  raw: string | null,
): RememberedUserPageRoute | null {
  if (!raw) {
    return null;
  }

  try {
    return parseRememberedUserPageRouteValue(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

function normalizeRecentSuccessfulUserPageRoutes(
  routes: readonly RememberedUserPageRoute[],
): RememberedUserPageRoute[] {
  const dedupedRoutes: RememberedUserPageRoute[] = [];
  const seenUserIds = new Set<string>();

  for (const route of [...routes].sort((a, b) => b.savedAt - a.savedAt)) {
    if (seenUserIds.has(route.userId)) {
      continue;
    }

    seenUserIds.add(route.userId);
    dedupedRoutes.push(route);

    if (dedupedRoutes.length >= MAX_RECENT_SUCCESSFUL_USER_PAGE_ROUTES) {
      break;
    }
  }

  return dedupedRoutes;
}

function parseRecentSuccessfulUserPageRoutes(
  raw: string | null,
): RememberedUserPageRoute[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return normalizeRecentSuccessfulUserPageRoutes(
      parsed
        .map((entry) => parseRememberedUserPageRouteValue(entry))
        .filter((entry): entry is RememberedUserPageRoute => entry !== null),
    );
  } catch {
    return [];
  }
}

function readLegacyLastSuccessfulUserPageRoute(): RememberedUserPageRoute | null {
  return parseRememberedUserPageRoute(
    readContinuityStorageValue(LAST_SUCCESSFUL_USER_PAGE_ROUTE_STORAGE_KEY),
  );
}

export function getRememberedUserPageRouteLabel(
  route: RememberedUserPageRoute,
): string {
  return route.username ? `@${route.username}` : `AniList user ${route.userId}`;
}

export function getExamplesDiscoveryContextLabel(
  context: SearchLaunchDiscoveryContextLike,
): string {
  if (!context) {
    return "Examples";
  }

  let baseLabel = "Examples index";

  if (context.routeKind === "gallery") {
    baseLabel = "Full examples gallery";
  } else if (context.routeKind === "collection") {
    baseLabel = context.collectionName
      ? `${context.collectionName} collection`
      : "Examples collection";
  } else if (context.routeKind === "legacy") {
    baseLabel = context.collectionName
      ? `${context.collectionName} gallery`
      : "Examples gallery";
  }

  const searchQuery = normalizeNonBlankString(context.searchQuery);

  return searchQuery ? `${baseLabel} · “${searchQuery}”` : baseLabel;
}

export function getExamplesDiscoveryContextReturnLabel(
  context: SearchLaunchDiscoveryContextLike,
): string {
  if (!context) {
    return "Return to examples";
  }

  if (context.collectionName) {
    return `Return to ${context.collectionName}`;
  }

  if (context.routeKind === "gallery") {
    return "Return to full gallery";
  }

  return "Return to examples";
}

export function readSettingsTemplatesFromStorage(): SettingsTemplateV1[] {
  if (globalThis.window === undefined) return [];

  try {
    const raw = globalThis.window.localStorage.getItem(
      SETTINGS_TEMPLATES_STORAGE_KEY,
    );
    if (!raw) return [];

    const parsed = parseSettingsExportJson(raw);
    if (!parsed.ok || parsed.value.kind !== "export") return [];

    const exported = parsed.value.value;
    if (exported.scope === "templates") return exported.templates;
    if (exported.scope === "all") return exported.templates;
    return [];
  } catch {
    return [];
  }
}

export function writeSettingsTemplatesToStorage(
  templates: SettingsTemplateV1[],
): SettingsTemplatesStorageResult {
  if (globalThis.window === undefined) {
    return {
      ok: false,
      error: SETTINGS_TEMPLATES_STORAGE_ERROR,
    };
  }

  try {
    const payload = makeSettingsExport({
      schemaVersion: 1,
      scope: "templates",
      templates,
    });

    globalThis.window.localStorage.setItem(
      SETTINGS_TEMPLATES_STORAGE_KEY,
      JSON.stringify(payload),
    );
    return { ok: true };
  } catch {
    return {
      ok: false,
      error: SETTINGS_TEMPLATES_STORAGE_ERROR,
    };
  }
}

export function upsertSettingsTemplate(
  templates: readonly SettingsTemplateV1[],
  template: SettingsTemplateV1,
): SettingsTemplateV1[] {
  const existingIndex = templates.findIndex(
    (entry) => entry.id === template.id,
  );
  if (existingIndex < 0) {
    return [...templates, template];
  }

  const existing = templates[existingIndex];
  const next = [...templates];
  next[existingIndex] = {
    ...template,
    createdAt: existing.createdAt,
  };
  return next;
}

export function upsertSettingsTemplateInStorage(
  template: SettingsTemplateV1,
):
  | { ok: true; templates: SettingsTemplateV1[] }
  | { ok: false; error: string } {
  const next = upsertSettingsTemplate(
    readSettingsTemplatesFromStorage(),
    template,
  );
  const writeResult = writeSettingsTemplatesToStorage(next);
  if (!writeResult.ok) {
    return writeResult;
  }
  return { ok: true, templates: next };
}

export function queuePendingSettingsTemplateApply(
  pending: PendingSettingsTemplateApply,
): void {
  if (globalThis.window === undefined) return;

  try {
    writeContinuityStorageValue(
      PENDING_SETTINGS_TEMPLATE_APPLY_STORAGE_KEY,
      JSON.stringify(pending),
    );
    dispatchSearchLaunchContinuityChange();
  } catch {
    // Ignore session persistence failures.
  }
}

export function rememberExamplesDiscoveryContext(
  context:
    | SearchLaunchDiscoveryContextInput
    | SearchLaunchDiscoveryContext
    | null
    | undefined,
): void {
  if (globalThis.window === undefined) {
    return;
  }

  const nextContext = buildSearchLaunchDiscoveryContext(context);

  if (!nextContext) {
    return;
  }

  try {
    writeContinuityStorageValue(
      EXAMPLES_DISCOVERY_CONTEXT_STORAGE_KEY,
      JSON.stringify(nextContext),
    );
    dispatchSearchLaunchContinuityChange();
  } catch {
    // Ignore continuity persistence failures.
  }
}

export function queueSettingsTemplateForEditor(
  template: SettingsTemplateV1,
  options: QueueSettingsTemplateForEditorOptions = {},
):
  | {
      ok: true;
      template: SettingsTemplateV1;
      templates: SettingsTemplateV1[];
      pendingTemplateApply: PendingSettingsTemplateApply;
    }
  | { ok: false; error: string } {
  const persistResult = upsertSettingsTemplateInStorage(template);
  if (!persistResult.ok) {
    return persistResult;
  }

  const queuedAt = Date.now();
  const discoveryContext = buildSearchLaunchDiscoveryContext(
    options.discoveryContext,
    queuedAt,
  );

  if (discoveryContext) {
    rememberExamplesDiscoveryContext(discoveryContext);
  }

  const pendingTemplateApply: PendingSettingsTemplateApply = {
    templateId: template.id,
    templateName: template.name,
    applyTo: "global",
    source: options.source ?? "examples",
    queuedAt,
    exampleContext: options.exampleContext,
    discoveryContext: discoveryContext ?? undefined,
    starterWorkspaceSeed:
      options.starterWorkspaceSeed ??
      buildNewUserStarterWorkspaceSeed(template.snapshot),
  };

  queuePendingSettingsTemplateApply(pendingTemplateApply);

  return {
    ok: true,
    template,
    templates: persistResult.templates,
    pendingTemplateApply,
  };
}

export function readPendingSettingsTemplateApply(): PendingSettingsTemplateApply | null {
  if (globalThis.window === undefined) return null;

  try {
    const raw = readContinuityStorageValue(
      PENDING_SETTINGS_TEMPLATE_APPLY_STORAGE_KEY,
    );

    return parsePendingSettingsTemplateApply(raw);
  } catch {
    return null;
  }
}

export function clearPendingSettingsTemplateApply(): void {
  if (globalThis.window === undefined) return;

  try {
    removeContinuityStorageValue(PENDING_SETTINGS_TEMPLATE_APPLY_STORAGE_KEY);
    dispatchSearchLaunchContinuityChange();
  } catch {
    // Ignore session persistence failures.
  }
}

export function consumePendingSettingsTemplateApply(): PendingSettingsTemplateApply | null {
  if (globalThis.window === undefined) return null;

  try {
    const raw = readContinuityStorageValue(
      PENDING_SETTINGS_TEMPLATE_APPLY_STORAGE_KEY,
    );
    if (!raw) return null;

    removeContinuityStorageValue(PENDING_SETTINGS_TEMPLATE_APPLY_STORAGE_KEY);
    dispatchSearchLaunchContinuityChange();

    return parsePendingSettingsTemplateApply(raw);
  } catch {
    return null;
  }
}

export function rememberLastSuccessfulUserPageRoute(params: {
  userId: string;
  username?: string | null;
}): void {
  if (globalThis.window === undefined) return;

  const normalizedUserId = normalizePositiveIntegerString(params.userId);
  if (!normalizedUserId) return;

  const normalizedUsername = normalizeNonBlankString(params.username);
  const nextRoute = {
    href: buildRememberedUserPageHref({
      userId: normalizedUserId,
      username: normalizedUsername,
    }),
    userId: normalizedUserId,
    username: normalizedUsername,
    savedAt: Date.now(),
  } satisfies RememberedUserPageRoute;
  const nextRecentRoutes = normalizeRecentSuccessfulUserPageRoutes([
    nextRoute,
    ...readRecentSuccessfulUserPageRoutes(),
  ]);

  try {
    writeContinuityStorageValue(
      RECENT_SUCCESSFUL_USER_PAGE_ROUTES_STORAGE_KEY,
      JSON.stringify(nextRecentRoutes),
    );
    writeContinuityStorageValue(
      LAST_SUCCESSFUL_USER_PAGE_ROUTE_STORAGE_KEY,
      JSON.stringify(nextRecentRoutes[0] ?? nextRoute),
    );
    dispatchSearchLaunchContinuityChange();
  } catch {
    // Ignore session persistence failures.
  }
}

export function readRecentSuccessfulUserPageRoutes(): RememberedUserPageRoute[] {
  if (globalThis.window === undefined) {
    return [];
  }

  const recentRoutes = parseRecentSuccessfulUserPageRoutes(
    readContinuityStorageValue(RECENT_SUCCESSFUL_USER_PAGE_ROUTES_STORAGE_KEY),
  );

  if (recentRoutes.length > 0) {
    return recentRoutes;
  }

  const legacyRoute = readLegacyLastSuccessfulUserPageRoute();

  return legacyRoute ? [legacyRoute] : [];
}

export function readLastSuccessfulUserPageRoute(): RememberedUserPageRoute | null {
  const recentRoutes = readRecentSuccessfulUserPageRoutes();

  return recentRoutes[0] ?? readLegacyLastSuccessfulUserPageRoute();
}

export function readExamplesDiscoveryContext(): SearchLaunchDiscoveryContext | null {
  if (globalThis.window === undefined) {
    return null;
  }

  return parseSearchLaunchDiscoveryContext(
    readContinuityStorageValue(EXAMPLES_DISCOVERY_CONTEXT_STORAGE_KEY),
  );
}

export function readSearchLaunchContinuityState(): SearchLaunchContinuityState {
  const recentSuccessfulUserRoutes = readRecentSuccessfulUserPageRoutes();

  return {
    pendingTemplateApply: readPendingSettingsTemplateApply(),
    lastSuccessfulUserRoute: recentSuccessfulUserRoutes[0] ?? null,
    recentSuccessfulUserRoutes,
    lastDiscoveryContext: readExamplesDiscoveryContext(),
  };
}

export function subscribeSearchLaunchContinuity(
  onChange: (state: SearchLaunchContinuityState) => void,
): () => void {
  if (globalThis.window === undefined) {
    return () => undefined;
  }

  const handleChange = () => {
    onChange(readSearchLaunchContinuityState());
  };
  const handleStorage = (event: StorageEvent) => {
    if (!isSearchLaunchContinuityStorageKey(event.key)) {
      return;
    }

    handleChange();
  };

  globalThis.window.addEventListener(
    SEARCH_LAUNCH_CONTINUITY_EVENT,
    handleChange,
  );
  globalThis.window.addEventListener("storage", handleStorage);

  return () => {
    globalThis.window.removeEventListener(
      SEARCH_LAUNCH_CONTINUITY_EVENT,
      handleChange,
    );
    globalThis.window.removeEventListener("storage", handleStorage);
  };
}
