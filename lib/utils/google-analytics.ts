import type { ErrorCategory } from "@/lib/error-messages";

export type AnalyticsConsentState = "unset" | "granted" | "denied";

export const ANALYTICS_CONSENT_STORAGE_KEY = "anicards:analytics-consent:v1";
export const ANALYTICS_CONSENT_EVENT = "anicards:analytics-consent-changed";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

type GtagFunction = (...args: unknown[]) => void;
type AnalyticsTelemetryMetadataValue = boolean | number | string | null;
type AnalyticsInstrumentationUserAction =
  | "analytics_consent_update"
  | "analytics_event_dispatch"
  | "analytics_pageview_dispatch"
  | "analytics_safe_track"
  | "analytics_script_load";

const MAX_ANALYTICS_TOKEN_LENGTH = 48;
const ANALYTICS_FAILURE_REPORT_COOLDOWN_MS = 1000 * 60;
const ANALYTICS_FAILURE_BUCKET_TTL_MS =
  ANALYTICS_FAILURE_REPORT_COOLDOWN_MS * 10;
const MAX_ANALYTICS_FAILURE_BUCKETS = 12;
const MAX_ANALYTICS_FAILURE_COUNT = 99;
const PAGE_TITLE_BY_PATH: Record<string, string> = {
  "/": "home",
  "/contact": "contact",
  "/examples": "examples",
  "/projects": "projects",
  "/search": "search",
  "/user": "user_profile",
  "/user/[username]": "user_profile",
  "/StatCards/[username]": "stat_cards_profile",
};

let cachedConsentState: AnalyticsConsentState = "unset";
const analyticsFailureBuckets = new Map<
  string,
  {
    lastReportedAt: number;
    lastSeenAt: number;
    suppressedSinceLastReport: number;
    totalCount: number;
  }
>();

interface AnalyticsInstrumentationFailureOptions {
  userAction: AnalyticsInstrumentationUserAction;
  error: unknown;
  category?: ErrorCategory;
  metadata?: Record<string, AnalyticsTelemetryMetadataValue | undefined>;
}

interface SafeTrackOptions {
  userAction?: AnalyticsInstrumentationUserAction;
  metadata?: Record<string, AnalyticsTelemetryMetadataValue | undefined>;
}

const isAsciiLowerAlphaNumeric = (char: string): boolean => {
  const code = char.codePointAt(0);

  return (
    code !== undefined &&
    ((code >= 97 && code <= 122) || (code >= 48 && code <= 57))
  );
};

const appendAnalyticsTokenSeparator = (value: string): string => {
  if (value.length >= MAX_ANALYTICS_TOKEN_LENGTH) return value;

  return `${value}_`;
};

const appendAnalyticsTokenChar = (value: string, char: string): string => {
  if (value.length >= MAX_ANALYTICS_TOKEN_LENGTH) return value;

  return `${value}${char}`;
};

const clampAnalyticsFailureCount = (value: number): number => {
  return Math.min(MAX_ANALYTICS_FAILURE_COUNT, Math.max(0, Math.trunc(value)));
};

const stripTrailingSlashes = (value: string): string => {
  let end = value.length;

  while (end > 1 && value.codePointAt(end - 1) === 47) {
    end--;
  }

  return end === value.length ? value : value.slice(0, end);
};

const hasSinglePathSegment = (pathname: string, prefix: string): boolean => {
  if (!pathname.startsWith(prefix)) return false;

  const remainder = pathname.slice(prefix.length);
  return remainder.length > 0 && !remainder.includes("/");
};

/**
 * Safely retrieve the global gtag function from globalThis in a way that
 * works both in browser and server environments.
 */
const getGtag = (): GtagFunction | undefined => {
  if (typeof globalThis === "undefined") return undefined;
  // globalThis in browsers is the Window object; cast safely to the Window type
  const win = globalThis as unknown as Window;
  return win.gtag;
};

const getStorage = (): Storage | undefined => {
  if (globalThis.window === undefined) return undefined;

  try {
    return globalThis.window.localStorage;
  } catch {
    return undefined;
  }
};

const sanitizeAnalyticsToken = (
  value: string,
  fallback = "unknown",
): string => {
  const normalizedInput = value.trim().toLowerCase();
  let normalized = "";
  let pendingSeparator = false;

  for (const char of normalizedInput) {
    if (!isAsciiLowerAlphaNumeric(char)) {
      pendingSeparator = normalized.length > 0;
      continue;
    }

    if (pendingSeparator && normalized.length > 0) {
      normalized = appendAnalyticsTokenSeparator(normalized);
    }

    pendingSeparator = false;
    normalized = appendAnalyticsTokenChar(normalized, char);
  }

  return normalized.length > 0 ? normalized : fallback;
};

const looksLikeUrl = (value: string): boolean => {
  return value.startsWith("/") || /^https?:\/\//i.test(value);
};

const looksSensitiveValue = (value: string): boolean => {
  return (
    /@/.test(value) ||
    /[?&=]/.test(value) ||
    /^\d{4,}$/.test(value) ||
    /^[a-f0-9-]{16,}$/i.test(value) ||
    value.length > 72
  );
};

const normalizePathname = (pathname: string): string => {
  const trimmed = pathname.trim();
  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  const withoutTrailingSlash = stripTrailingSlashes(withLeadingSlash);
  const normalizedPath = withoutTrailingSlash.toLowerCase();

  if (hasSinglePathSegment(normalizedPath, "/statcards/")) {
    return "/StatCards/[username]";
  }

  if (hasSinglePathSegment(normalizedPath, "/user/")) {
    return "/user/[username]";
  }

  return withoutTrailingSlash || "/";
};

const toSearchParams = (search?: string | URLSearchParams): URLSearchParams => {
  if (!search) return new URLSearchParams();

  if (typeof search === "string") {
    return new URLSearchParams(
      search.startsWith("?") ? search.slice(1) : search,
    );
  }

  return new URLSearchParams(search.toString());
};

const classifyAnalyticsError = (value?: string): string => {
  const text = (value ?? "").toLowerCase();

  if (text.includes("abort")) return "aborted";
  if (text.includes("timeout")) return "timeout";
  if (
    text.includes("network") ||
    text.includes("fetch") ||
    text.includes("load failed")
  ) {
    return "network";
  }
  if (
    text.includes("unauthorized") ||
    text.includes("forbidden") ||
    text.includes("permission")
  ) {
    return "authorization";
  }
  if (text.includes("not found") || text.includes("404")) {
    return "not_found";
  }
  if (
    text.includes("validation") ||
    text.includes("invalid") ||
    text.includes("required") ||
    text.includes("parse")
  ) {
    return "validation";
  }
  if (
    text.includes("quota") ||
    text.includes("too many") ||
    text.includes("429") ||
    text.includes("rate")
  ) {
    return "rate_limited";
  }
  if (text.includes("storage") || text.includes("localstorage")) {
    return "storage";
  }
  if (
    text.includes("typeerror") ||
    text.includes("referenceerror") ||
    text.includes("render")
  ) {
    return "runtime";
  }

  return "unknown";
};

const mapAnalyticsErrorBucketToCategory = (
  errorBucket: string,
): ErrorCategory => {
  switch (errorBucket) {
    case "authorization":
      return "authentication";
    case "network":
      return "network_error";
    case "rate_limited":
      return "rate_limited";
    case "timeout":
      return "timeout";
    case "validation":
      return "invalid_data";
    default:
      return "unknown";
  }
};

const getAnalyticsFailureFallbackMessage = (
  userAction: AnalyticsInstrumentationUserAction,
): string => {
  switch (userAction) {
    case "analytics_consent_update":
      return "Google Analytics consent update failed";
    case "analytics_event_dispatch":
      return "Google Analytics event dispatch failed";
    case "analytics_pageview_dispatch":
      return "Google Analytics pageview dispatch failed";
    case "analytics_safe_track":
      return "Safe analytics tracking call failed";
    case "analytics_script_load":
      return "Google Analytics loader script failed to load";
  }
};

const normalizeAnalyticsFailureError = (
  error: unknown,
  fallbackMessage: string,
): Error => {
  if (error instanceof Error) {
    return error;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  ) {
    return new Error((error as { message: string }).message);
  }

  return new Error(typeof error === "string" ? error : fallbackMessage);
};

const sanitizeAnalyticsTelemetryMetadata = (
  metadata:
    | Record<string, AnalyticsTelemetryMetadataValue | undefined>
    | undefined,
): Record<string, AnalyticsTelemetryMetadataValue> | undefined => {
  if (!metadata) return undefined;

  const entries = Object.entries(metadata).filter((entry) => {
    const value = entry[1];
    return (
      value === null ||
      typeof value === "string" ||
      typeof value === "boolean" ||
      (typeof value === "number" && Number.isFinite(value))
    );
  });

  return entries.length > 0
    ? (Object.fromEntries(entries) as Record<
        string,
        AnalyticsTelemetryMetadataValue
      >)
    : undefined;
};

const trimAnalyticsFailureBuckets = (now: number): void => {
  for (const [key, bucket] of analyticsFailureBuckets) {
    if (now - bucket.lastSeenAt > ANALYTICS_FAILURE_BUCKET_TTL_MS) {
      analyticsFailureBuckets.delete(key);
    }
  }

  if (analyticsFailureBuckets.size <= MAX_ANALYTICS_FAILURE_BUCKETS) {
    return;
  }

  const overflow = analyticsFailureBuckets.size - MAX_ANALYTICS_FAILURE_BUCKETS;
  const oldestBuckets = [...analyticsFailureBuckets.entries()]
    .sort((left, right) => left[1].lastSeenAt - right[1].lastSeenAt)
    .slice(0, overflow);

  for (const [key] of oldestBuckets) {
    analyticsFailureBuckets.delete(key);
  }
};

const reserveAnalyticsFailureReport = (options: {
  errorBucket: string;
  errorName: string;
  userAction: AnalyticsInstrumentationUserAction;
}):
  | {
      suppressedSinceLastReport: number;
      totalCount: number;
    }
  | undefined => {
  const now = Date.now();
  trimAnalyticsFailureBuckets(now);

  const fingerprint = [
    options.userAction,
    sanitizeAnalyticsToken(options.errorName, "error"),
    options.errorBucket,
  ].join(":");
  const existingBucket = analyticsFailureBuckets.get(fingerprint);
  const totalCount = clampAnalyticsFailureCount(
    (existingBucket?.totalCount ?? 0) + 1,
  );

  if (
    existingBucket &&
    now - existingBucket.lastReportedAt < ANALYTICS_FAILURE_REPORT_COOLDOWN_MS
  ) {
    analyticsFailureBuckets.set(fingerprint, {
      ...existingBucket,
      lastSeenAt: now,
      suppressedSinceLastReport: clampAnalyticsFailureCount(
        existingBucket.suppressedSinceLastReport + 1,
      ),
      totalCount,
    });
    return undefined;
  }

  const suppressedSinceLastReport =
    existingBucket?.suppressedSinceLastReport ?? 0;

  analyticsFailureBuckets.set(fingerprint, {
    lastReportedAt: now,
    lastSeenAt: now,
    suppressedSinceLastReport: 0,
    totalCount,
  });

  return {
    suppressedSinceLastReport,
    totalCount,
  };
};

export const reportAnalyticsInstrumentationFailure = (
  options: AnalyticsInstrumentationFailureOptions,
): Promise<void> => {
  if (globalThis.window === undefined) {
    return Promise.resolve();
  }

  const normalizedError = normalizeAnalyticsFailureError(
    options.error,
    getAnalyticsFailureFallbackMessage(options.userAction),
  );
  const errorBucket = classifyAnalyticsError(
    `${normalizedError.name} ${normalizedError.message}`,
  );
  const rateLimitState = reserveAnalyticsFailureReport({
    errorBucket,
    errorName: normalizedError.name,
    userAction: options.userAction,
  });

  if (!rateLimitState) {
    return Promise.resolve();
  }

  const metadata = sanitizeAnalyticsTelemetryMetadata({
    analyticsConfigured: Boolean(process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID),
    analyticsConsentState: cachedConsentState,
    analyticsFailureBucket: errorBucket,
    analyticsFailureCount: rateLimitState.totalCount,
    analyticsGtagAvailable: Boolean(getGtag()),
    analyticsSuppressedDuplicates: rateLimitState.suppressedSinceLastReport,
    ...options.metadata,
  });

  return import("@/lib/error-tracking")
    .then(async ({ reportStructuredError }) => {
      await reportStructuredError({
        source: "analytics_instrumentation",
        userAction: options.userAction,
        error: normalizedError,
        category:
          options.category ?? mapAnalyticsErrorBucketToCategory(errorBucket),
        metadata,
      });
    })
    .catch((error) => {
      if (process.env.NODE_ENV === "development") {
        console.error(
          "[AnalyticsTelemetry] Failed to report analytics instrumentation failure:",
          error,
        );
      }
    });
};

const buildAnalyticsErrorLabel = (
  errorType: string,
  errorMessage?: string,
): string => {
  const typeToken = sanitizeAnalyticsToken(errorType, "error");
  const errorBucket = classifyAnalyticsError(
    `${errorType} ${errorMessage ?? ""}`,
  );
  return sanitizeAnalyticsToken(`${typeToken}_${errorBucket}`, "error_unknown");
};

const buildSafePageQuery = (
  pathname: string,
  search?: string | URLSearchParams,
): string => {
  const normalizedPath = normalizePathname(pathname);
  const params = toSearchParams(search);
  const safeParams = new URLSearchParams();

  if (normalizedPath === "/user") {
    if (params.has("username")) safeParams.set("lookup", "username");
    else if (params.has("userId")) safeParams.set("lookup", "user_id");

    if (params.has("q")) safeParams.set("filter", "search");
  } else if (normalizedPath === "/user/[username]") {
    if (params.has("q")) {
      safeParams.set("filter", "search");
    } else if (
      (params.has("visibility") && params.get("visibility") !== "all") ||
      (params.has("group") && params.get("group") !== "All")
    ) {
      safeParams.set("filter", "filtered");
    }
  }

  return safeParams.toString();
};

const normalizeAnalyticsLabel = ({
  action,
  category,
  label,
}: {
  action: string;
  category: string;
  label?: string;
}): string | undefined => {
  if (!label) return undefined;

  const trimmed = label.trim();
  if (!trimmed) return undefined;

  if (category === "error") {
    if (/^[a-z0-9_]{1,48}$/.test(trimmed) && trimmed.includes("_")) {
      return sanitizeAnalyticsToken(trimmed, "error_unknown");
    }

    return buildAnalyticsErrorLabel(action, trimmed);
  }

  if (looksLikeUrl(trimmed)) {
    if (/^https?:\/\//i.test(trimmed)) {
      try {
        const parsedUrl = new URL(trimmed);
        return normalizeAnalyticsPage({
          pathname: parsedUrl.pathname,
          search: parsedUrl.search,
        }).pagePath;
      } catch {
        return "redacted";
      }
    }

    const [pathPart, searchPart] = trimmed.split("?", 2);
    return normalizeAnalyticsPage({
      pathname: pathPart,
      search: searchPart,
    }).pagePath;
  }

  if (/^\d{4,}$/.test(trimmed)) {
    return "numeric_value";
  }

  if (looksSensitiveValue(trimmed)) {
    return "redacted";
  }

  return sanitizeAnalyticsToken(trimmed);
};

export function buildAnalyticsConsentMode(granted: boolean): {
  analytics_storage: "granted" | "denied";
  ad_storage: "denied";
  ad_user_data: "denied";
  ad_personalization: "denied";
} {
  return {
    analytics_storage: granted ? "granted" : "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  };
}

export function updateAnalyticsConsentMode(granted: boolean): void {
  const gtag = getGtag();
  if (!gtag) return;

  try {
    gtag("consent", "update", buildAnalyticsConsentMode(granted));
  } catch (error) {
    void reportAnalyticsInstrumentationFailure({
      userAction: "analytics_consent_update",
      error,
      metadata: {
        consentGranted: granted,
      },
    });
  }
}

export function getAnalyticsConsentState(): AnalyticsConsentState {
  const storage = getStorage();
  const rawValue = storage?.getItem(ANALYTICS_CONSENT_STORAGE_KEY) ?? null;

  cachedConsentState =
    rawValue === "granted" || rawValue === "denied" ? rawValue : "unset";

  return cachedConsentState;
}

export function setAnalyticsConsentState(
  nextState: Exclude<AnalyticsConsentState, "unset">,
): void {
  cachedConsentState = nextState;

  try {
    getStorage()?.setItem(ANALYTICS_CONSENT_STORAGE_KEY, nextState);
  } catch {
    // Ignore storage failures; in-memory consent still applies for this tab.
  }

  updateAnalyticsConsentMode(nextState === "granted");

  if (globalThis.window !== undefined) {
    globalThis.window.dispatchEvent(
      new CustomEvent(ANALYTICS_CONSENT_EVENT, {
        detail: nextState,
      }),
    );
  }
}

export function hasAnalyticsConsent(): boolean {
  return getAnalyticsConsentState() === "granted";
}

export function normalizeAnalyticsPage({
  pathname,
  search,
}: {
  pathname: string;
  search?: string | URLSearchParams;
}): {
  pagePath: string;
  pageTitle: string;
  pageLocation: string;
} {
  const normalizedPath = normalizePathname(pathname);
  const safeQuery = buildSafePageQuery(normalizedPath, search);
  const pagePath = safeQuery
    ? `${normalizedPath}?${safeQuery}`
    : normalizedPath;
  const pageTitle =
    PAGE_TITLE_BY_PATH[normalizedPath] ??
    sanitizeAnalyticsToken(normalizedPath.replaceAll("/", "_"), "page");
  const pageLocation =
    globalThis.location === undefined
      ? pagePath
      : new URL(pagePath, globalThis.location.origin).toString();

  return {
    pagePath,
    pageTitle,
    pageLocation,
  };
}

/**
 * Send a pageview event to Google Analytics using the configured GA property.
 * @param pathname - The current route pathname.
 * @param search - Optional query string used for route normalization.
 * @source
 */
export const pageview = ({
  pathname,
  search,
}: {
  pathname: string;
  search?: string | URLSearchParams;
}): void => {
  const gaId = process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID;
  const gtag = getGtag();
  if (gtag && gaId && hasAnalyticsConsent()) {
    const { pageLocation, pagePath, pageTitle } = normalizeAnalyticsPage({
      pathname,
      search,
    });

    try {
      gtag("event", "page_view", {
        send_to: gaId,
        page_path: pagePath,
        page_title: pageTitle,
        page_location: pageLocation,
      });
    } catch (error) {
      void reportAnalyticsInstrumentationFailure({
        userAction: "analytics_pageview_dispatch",
        error,
        metadata: {
          pagePath,
          pageTitle,
        },
      });
    }
  }
};

/**
 * Send a custom event to Google Analytics via gtag.
 * @param action - Event action name used in GA.
 * @param category - The category to group the event within.
 * @param label - Optional label for additional context.
 * @param value - Optional numeric value for metrics.
 * @source
 */
export const event = ({
  action,
  category,
  label,
  value,
}: {
  action: string;
  category: string;
  label?: string;
  value?: number;
}) => {
  const gaId = process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID;
  const gtag = getGtag();
  if (gtag && gaId && hasAnalyticsConsent()) {
    const normalizedAction = sanitizeAnalyticsToken(action, "event");
    const normalizedCategory = sanitizeAnalyticsToken(category, "engagement");
    const normalizedLabel = normalizeAnalyticsLabel({
      action: normalizedAction,
      category: normalizedCategory,
      label,
    });

    try {
      gtag("event", normalizedAction, {
        send_to: gaId,
        event_category: normalizedCategory,
        event_label: normalizedLabel,
        value:
          typeof value === "number" && Number.isFinite(value)
            ? value
            : undefined,
      });
    } catch (error) {
      void reportAnalyticsInstrumentationFailure({
        userAction: "analytics_event_dispatch",
        error,
        metadata: {
          eventAction: normalizedAction,
          eventCategory: normalizedCategory,
          eventLabelPresent: normalizedLabel !== undefined,
        },
      });
    }
  }
};

/**
 * Thin helper used across the app to safely invoke analytics code without
 * allowing exceptions thrown by analytics shims to crash the UI.
 */
export const safeTrack = (fn: () => void, options?: SafeTrackOptions) => {
  if (!hasAnalyticsConsent()) return;

  try {
    fn();
  } catch (error) {
    void reportAnalyticsInstrumentationFailure({
      userAction: options?.userAction ?? "analytics_safe_track",
      error,
      metadata: options?.metadata,
    });
  }
};

/** Track a settings change event with GA. @source */
export const trackSettingsChanged = (settingType: string) => {
  event({
    action: "settings_changed",
    category: "engagement",
    label: settingType,
  });
};

/** Track button clicks in the UI with optional context. @source */
export const trackButtonClick = (buttonName: string, context?: string) => {
  event({
    action: "button_clicked",
    category: "engagement",
    label: context ? `${buttonName}_${context}` : buttonName,
  });
};

/** Track a navigation event including the destination and optional source context. @source */
export const trackNavigation = (
  destinationPage: string,
  sourceContext?: string,
) => {
  event({
    action: "navigation",
    category: "engagement",
    label: sourceContext
      ? `${sourceContext}_to_${destinationPage}`
      : destinationPage,
  });
};

/** Track when a color preset is selected in the UI. @source */
export const trackColorPresetSelection = (presetName: string) => {
  event({
    action: "color_preset_selected",
    category: "customization",
    label: presetName,
  });
};

/** Track form submission success or failure for product analytics. @source */
export const trackFormSubmission = (formType: string, success: boolean) => {
  event({
    action: success ? "form_submitted_success" : "form_submitted_error",
    category: "conversion",
    label: formType,
  });
};

/** Track clicks on external links with optional context indicating origin. @source */
export const trackExternalLinkClick = (
  linkDestination: string,
  context?: string,
) => {
  event({
    action: "external_link_clicked",
    category: "engagement",
    label: context ? `${context}_${linkDestination}` : linkDestination,
  });
};

/** Track an error event capturing type and optional message. @source */
export const trackError = (errorType: string, errorMessage?: string) => {
  event({
    action: "error_occurred",
    category: "error",
    label: buildAnalyticsErrorLabel(errorType, errorMessage),
  });
};
