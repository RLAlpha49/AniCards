import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const DEVELOPMENT_PROTECTED_WRITE_GRANT_SECRET =
  "anicards-dev-write-grant-secret";

const PROTECTED_WRITE_GRANT_VERSION = 1;

export const PROTECTED_WRITE_GRANT_TTL_SECONDS = 4 * 60 * 60;
export const PROTECTED_WRITE_GRANT_COOKIE_NAME_PREFIX = "anicards_write_grant_";

type ProtectedWriteGrantPayload = {
  exp: number;
  source: "anilist_stats" | "stored_user";
  statsHash?: string;
  userId: string;
  username?: string;
  usernameNormalized?: string;
  v: number;
};

export type ProtectedWriteGrant = {
  source: ProtectedWriteGrantPayload["source"] | "test_bypass";
  statsHash?: string;
  userId: string;
  username?: string;
  usernameNormalized?: string;
};

type ProtectedWriteGrantFailureReason =
  | "expired"
  | "invalid_payload"
  | "invalid_signature"
  | "malformed_token"
  | "missing_secret"
  | "missing_stats_hash"
  | "missing_token"
  | "stats_hash_mismatch"
  | "user_id_mismatch";

export type ProtectedWriteGrantVerificationResult =
  | {
      payload?: ProtectedWriteGrantPayload;
      reason?: "test_bypass";
      valid: true;
    }
  | {
      reason: ProtectedWriteGrantFailureReason;
      valid: false;
    };

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

function getProtectedWriteGrantSecret(): string | null {
  const configuredSecret = process.env.API_SECRET_TOKEN?.trim();
  if (configuredSecret) {
    return configuredSecret;
  }

  if (!isProduction()) {
    return DEVELOPMENT_PROTECTED_WRITE_GRANT_SECRET;
  }

  return null;
}

export function isProtectedWriteGrantEnforced(): boolean {
  return !(
    process.env.NODE_ENV === "test" && !process.env.API_SECRET_TOKEN?.trim()
  );
}

function normalizeUsername(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeUsernameForIndex(value: unknown): string | undefined {
  const normalized = normalizeUsername(value)?.toLowerCase();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

function stableStringify(value: unknown): string {
  if (value === null) {
    return "null";
  }

  switch (typeof value) {
    case "string":
      return JSON.stringify(value);
    case "number":
      return Number.isFinite(value) ? JSON.stringify(value) : "null";
    case "boolean":
      return value ? "true" : "false";
    case "bigint":
      return JSON.stringify(value.toString());
    case "undefined":
    case "function":
    case "symbol":
      return "null";
    case "object":
      if (Array.isArray(value)) {
        return `[${value.map((item) => stableStringify(item)).join(",")}]`;
      }

      return `{${Object.entries(value as Record<string, unknown>)
        .filter(([, nestedValue]) => nestedValue !== undefined)
        .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
        .map(
          ([nestedKey, nestedValue]) =>
            `${JSON.stringify(nestedKey)}:${stableStringify(nestedValue)}`,
        )
        .join(",")}}`;
  }

  return "null";
}

function signGrantPayload(payloadSegment: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(payloadSegment)
    .digest("base64url");
}

function isProtectedWriteGrantPayload(
  value: unknown,
): value is ProtectedWriteGrantPayload {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<ProtectedWriteGrantPayload>;
  return (
    candidate.v === PROTECTED_WRITE_GRANT_VERSION &&
    (candidate.source === "anilist_stats" ||
      candidate.source === "stored_user") &&
    typeof candidate.userId === "string" &&
    candidate.userId.length > 0 &&
    typeof candidate.exp === "number" &&
    Number.isFinite(candidate.exp) &&
    (candidate.statsHash === undefined ||
      typeof candidate.statsHash === "string") &&
    (candidate.username === undefined ||
      typeof candidate.username === "string") &&
    (candidate.usernameNormalized === undefined ||
      typeof candidate.usernameNormalized === "string")
  );
}

function buildGrantToken(
  payload: ProtectedWriteGrantPayload,
  secret: string,
): string {
  const payloadSegment = Buffer.from(JSON.stringify(payload)).toString(
    "base64url",
  );
  const signatureSegment = signGrantPayload(payloadSegment, secret);
  return `${payloadSegment}.${signatureSegment}`;
}

export function getProtectedWriteGrantCookieName(
  userId: string | number,
): string {
  return `${PROTECTED_WRITE_GRANT_COOKIE_NAME_PREFIX}${String(userId).trim()}`;
}

export async function computeProtectedWriteStatsHash(
  statsPayload: unknown,
): Promise<string> {
  return createHash("sha256")
    .update(stableStringify(statsPayload))
    .digest("base64url");
}

export function getProtectedWriteGrantCookie(
  request: Pick<Request, "headers"> | undefined,
  userId: string | number,
): string | null {
  const cookieHeader = request?.headers.get("cookie");
  if (!cookieHeader) {
    return null;
  }

  const cookieName = getProtectedWriteGrantCookieName(userId);

  for (const entry of cookieHeader.split(";")) {
    const [rawName, ...rawValue] = entry.split("=");
    if (rawName?.trim() !== cookieName) {
      continue;
    }

    return rawValue.join("=").trim() || null;
  }

  return null;
}

export async function createProtectedWriteGrantCookie(options: {
  expiresAtMs?: number;
  source: Exclude<ProtectedWriteGrant["source"], "test_bypass">;
  statsPayload?: unknown;
  userId: string | number;
  username?: string;
}): Promise<{
  httpOnly: true;
  maxAge: number;
  name: string;
  path: string;
  sameSite: "strict";
  secure: boolean;
  value: string;
} | null> {
  const secret = getProtectedWriteGrantSecret();
  if (!secret) {
    return null;
  }

  const normalizedUsername = normalizeUsername(options.username);
  const payload: ProtectedWriteGrantPayload = {
    v: PROTECTED_WRITE_GRANT_VERSION,
    source: options.source,
    userId: String(options.userId),
    exp: Math.trunc(
      options.expiresAtMs ??
        Date.now() + PROTECTED_WRITE_GRANT_TTL_SECONDS * 1000,
    ),
    ...(normalizedUsername ? { username: normalizedUsername } : {}),
    ...(normalizedUsername
      ? { usernameNormalized: normalizeUsernameForIndex(normalizedUsername) }
      : {}),
    ...(options.source === "anilist_stats" && options.statsPayload !== undefined
      ? {
          statsHash: await computeProtectedWriteStatsHash(options.statsPayload),
        }
      : {}),
  };

  return {
    name: getProtectedWriteGrantCookieName(payload.userId),
    value: buildGrantToken(payload, secret),
    httpOnly: true,
    sameSite: "strict",
    secure: isProduction(),
    path: "/",
    maxAge: PROTECTED_WRITE_GRANT_TTL_SECONDS,
  };
}

export async function createProtectedWriteGrantCookieHeader(options: {
  expiresAtMs?: number;
  source: Exclude<ProtectedWriteGrant["source"], "test_bypass">;
  statsPayload?: unknown;
  userId: string | number;
  username?: string;
}): Promise<string | null> {
  const cookie = await createProtectedWriteGrantCookie(options);
  if (!cookie) {
    return null;
  }

  const attributes = [
    `${cookie.name}=${cookie.value}`,
    `Max-Age=${cookie.maxAge}`,
    `Path=${cookie.path}`,
    "HttpOnly",
    "SameSite=Strict",
  ];

  if (cookie.secure) {
    attributes.push("Secure");
  }

  return attributes.join("; ");
}

export function getAuthoritativeUsernameFromUserStats(
  statsPayload: unknown,
): string | undefined {
  if (typeof statsPayload !== "object" || statsPayload === null) {
    return undefined;
  }

  const user = (statsPayload as { User?: unknown }).User;
  if (typeof user !== "object" || user === null) {
    return undefined;
  }

  return normalizeUsername((user as { name?: unknown }).name);
}

export async function verifyProtectedWriteGrantToken(
  token: string | null | undefined,
  options: {
    expectedStatsPayload?: unknown;
    expectedUserId: string | number;
    requireStatsHash?: boolean;
  },
): Promise<ProtectedWriteGrantVerificationResult> {
  if (!isProtectedWriteGrantEnforced()) {
    return { valid: true, reason: "test_bypass" };
  }

  const secret = getProtectedWriteGrantSecret();
  if (!secret) {
    return { valid: false, reason: "missing_secret" };
  }

  if (!token) {
    return { valid: false, reason: "missing_token" };
  }

  const [payloadSegment, signatureSegment, ...rest] = token.split(".");
  if (!payloadSegment || !signatureSegment || rest.length > 0) {
    return { valid: false, reason: "malformed_token" };
  }

  const expectedSignature = Buffer.from(
    signGrantPayload(payloadSegment, secret),
    "base64url",
  );
  const actualSignature = Buffer.from(signatureSegment, "base64url");

  if (
    expectedSignature.length !== actualSignature.length ||
    !timingSafeEqual(expectedSignature, actualSignature)
  ) {
    return { valid: false, reason: "invalid_signature" };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(
      Buffer.from(payloadSegment, "base64url").toString("utf8"),
    );
  } catch {
    return { valid: false, reason: "invalid_payload" };
  }

  if (!isProtectedWriteGrantPayload(payload)) {
    return { valid: false, reason: "invalid_payload" };
  }

  if (payload.exp <= Date.now()) {
    return { valid: false, reason: "expired" };
  }

  if (payload.userId !== String(options.expectedUserId)) {
    return { valid: false, reason: "user_id_mismatch" };
  }

  if (options.requireStatsHash) {
    if (!payload.statsHash || options.expectedStatsPayload === undefined) {
      return { valid: false, reason: "missing_stats_hash" };
    }

    const expectedStatsHash = await computeProtectedWriteStatsHash(
      options.expectedStatsPayload,
    );

    if (expectedStatsHash !== payload.statsHash) {
      return { valid: false, reason: "stats_hash_mismatch" };
    }
  }

  return { valid: true, payload };
}
