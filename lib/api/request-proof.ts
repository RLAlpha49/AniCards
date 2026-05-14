import {
  canUseLocalhostSecurityFallbacks,
  hasConfiguredRootApiSecret,
  resolvePurposeScopedSigningSecret,
} from "@/lib/api/local-runtime";

const DEFAULT_TRUSTED_CLIENT_IP_HEADERS = [
  "x-vercel-forwarded-for",
  "cf-connecting-ip",
] as const;

const BUILT_IN_PROXY_FAMILY_HEADERS = {
  cloudflare: ["cf-connecting-ip"],
  vercel: ["x-vercel-forwarded-for"],
} as const;

const BUILT_IN_PROXY_FAMILY_ENV_HINTS = {
  cloudflare: ["CF_PAGES", "CF_PAGES_URL"],
  vercel: ["VERCEL", "VERCEL_URL"],
} as const;

const DEFAULT_TRUSTED_CLIENT_IP_PROVENANCE_HEADERS = {
  "x-vercel-forwarded-for": ["x-vercel-id"],
  "cf-connecting-ip": ["cf-ray"],
} as const satisfies Record<
  (typeof DEFAULT_TRUSTED_CLIENT_IP_HEADERS)[number],
  readonly string[]
>;
const TRUSTED_CLIENT_IP_HEADER_PROVENANCE_ENV =
  "TRUSTED_CLIENT_IP_HEADER_PROVENANCE";
const TRUSTED_CLIENT_IP_PROXY_FAMILY_ENV = "TRUSTED_CLIENT_IP_PROXY_FAMILY";
const REQUEST_PROOF_VERSION = 1;
const REQUEST_PROOF_USER_AGENT_MAX_LENGTH = 240;

export const REQUEST_PROOF_COOKIE_NAME = "__Host-anicards_request_proof";
export const LEGACY_REQUEST_PROOF_COOKIE_NAME = "anicards_request_proof";
export const REQUEST_PROOF_TTL_SECONDS = 4 * 60 * 60;

const ACCEPTED_REQUEST_PROOF_COOKIE_NAMES = [
  REQUEST_PROOF_COOKIE_NAME,
  LEGACY_REQUEST_PROOF_COOKIE_NAME,
] as const;

type BuiltInProxyFamily = keyof typeof BUILT_IN_PROXY_FAMILY_HEADERS;
type RequestProofCookieName =
  (typeof ACCEPTED_REQUEST_PROOF_COOKIE_NAMES)[number];

type RequestProofPayload = {
  exp: number;
  ipHash: string;
  uaHash: string;
  v: typeof REQUEST_PROOF_VERSION;
};

type RequestProofFailureReason =
  | "expired"
  | "invalid_payload"
  | "invalid_signature"
  | "ip_mismatch"
  | "malformed_token"
  | "missing_secret"
  | "missing_token"
  | "user_agent_mismatch";

export type RequestProofVerificationResult =
  | {
      payload?: RequestProofPayload;
      reason?: "test_bypass";
      valid: true;
    }
  | {
      reason: RequestProofFailureReason;
      valid: false;
    };

export type VerifiedClientIpResult =
  | {
      ip: string;
      source: string;
      verified: true;
    }
  | {
      ip: null;
      reason:
        | "conflicting_proxy_families"
        | "invalid_trusted_header"
        | "missing_proxy_provenance"
        | "missing_trusted_header"
        | "untrusted_proxy_family";
      source: null;
      verified: false;
    };

type ResolvedRequestProofCookie = {
  ambiguous: boolean;
  hasAnyCookieCandidate: boolean;
  hasLegacyCookie: boolean;
  source: RequestProofCookieName | null;
  value: string | null;
};

type RequestProofEnvelopeVerificationResult =
  | {
      payload: RequestProofPayload;
      valid: true;
    }
  | {
      reason: Exclude<
        RequestProofFailureReason,
        "ip_mismatch" | "user_agent_mismatch"
      >;
      valid: false;
    };

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const requestProofKeyCache = new Map<string, Promise<CryptoKey>>();

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

function normalizeHeaderName(value: string): string | null {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  return /^[a-z0-9-]+$/.test(normalized) ? normalized : null;
}

function normalizeBuiltInProxyFamily(
  value: string | undefined,
): BuiltInProxyFamily | null {
  const normalized = value?.trim().toLowerCase();

  switch (normalized) {
    case "cloudflare":
    case "vercel":
      return normalized;
    default:
      return null;
  }
}

function resolveTrustedBuiltInProxyFamily(): BuiltInProxyFamily | null {
  const configuredFamily = normalizeBuiltInProxyFamily(
    process.env[TRUSTED_CLIENT_IP_PROXY_FAMILY_ENV],
  );
  if (configuredFamily) {
    return configuredFamily;
  }

  const detectedFamilies = Object.entries(BUILT_IN_PROXY_FAMILY_ENV_HINTS)
    .filter(([, envHints]) =>
      envHints.some((envName) => Boolean(process.env[envName]?.trim())),
    )
    .map(([family]) => family as BuiltInProxyFamily);

  if (detectedFamilies.length !== 1) {
    return null;
  }

  return detectedFamilies[0];
}

function parseTrustedClientIpHeaderList(
  rawConfigured: string | undefined,
): string[] {
  return (rawConfigured ?? "")
    .split(",")
    .map((value) => normalizeHeaderName(value))
    .filter((value): value is string => value !== null);
}

function parseConfiguredTrustedClientIpProvenanceMap(): Map<
  string,
  readonly string[]
> {
  const rawConfigured =
    process.env[TRUSTED_CLIENT_IP_HEADER_PROVENANCE_ENV]?.trim();
  const provenanceMap = new Map<string, readonly string[]>();

  if (!rawConfigured) {
    return provenanceMap;
  }

  for (const rawEntry of rawConfigured.split(",")) {
    const [rawHeaderName, rawProvenanceHeaders, ...rest] = rawEntry.split("=");
    if (!rawHeaderName || !rawProvenanceHeaders || rest.length > 0) {
      continue;
    }

    const headerName = normalizeHeaderName(rawHeaderName);
    if (!headerName) {
      continue;
    }

    const provenanceHeaders = rawProvenanceHeaders
      .split("|")
      .map((value) => normalizeHeaderName(value))
      .filter((value): value is string => value !== null);
    if (provenanceHeaders.length === 0) {
      continue;
    }

    const existingHeaders = provenanceMap.get(headerName) ?? [];
    provenanceMap.set(
      headerName,
      Array.from(new Set([...existingHeaders, ...provenanceHeaders])),
    );
  }

  return provenanceMap;
}

function getTrustedClientIpProvenanceHeaders(
  headerName: string,
): readonly string[] | null {
  const builtInProvenanceHeaders =
    DEFAULT_TRUSTED_CLIENT_IP_PROVENANCE_HEADERS[
      headerName as keyof typeof DEFAULT_TRUSTED_CLIENT_IP_PROVENANCE_HEADERS
    ];
  if (builtInProvenanceHeaders && builtInProvenanceHeaders.length > 0) {
    return builtInProvenanceHeaders;
  }

  return parseConfiguredTrustedClientIpProvenanceMap().get(headerName) ?? null;
}

function getTrustedClientIpHeaderFamily(
  headerName: string,
): BuiltInProxyFamily | "custom" {
  for (const [family, headerNames] of Object.entries(
    BUILT_IN_PROXY_FAMILY_HEADERS,
  ) as Array<[BuiltInProxyFamily, readonly string[]]>) {
    if (headerNames.includes(headerName)) {
      return family;
    }
  }

  return "custom";
}

function resolveVerifiedClientIpFailureReason(options: {
  sawConflictingProxyFamilies: boolean;
  sawHeaderWithoutProxyProvenance: boolean;
  sawTrustedHeader: boolean;
  sawUntrustedProxyFamily: boolean;
}): Extract<VerifiedClientIpResult, { verified: false }>["reason"] {
  if (options.sawConflictingProxyFamilies) {
    return "conflicting_proxy_families";
  }

  if (options.sawUntrustedProxyFamily) {
    return "untrusted_proxy_family";
  }

  if (options.sawHeaderWithoutProxyProvenance) {
    return "missing_proxy_provenance";
  }

  return options.sawTrustedHeader
    ? "invalid_trusted_header"
    : "missing_trusted_header";
}

export function getTrustedClientIpHeaderNames(): string[] {
  const configured = parseTrustedClientIpHeaderList(
    process.env.TRUSTED_CLIENT_IP_HEADERS?.trim(),
  );

  return Array.from(
    new Set([...DEFAULT_TRUSTED_CLIENT_IP_HEADERS, ...configured]),
  );
}

function extractFirstForwardedToken(value: string): string {
  return value.split(",")[0]?.trim() ?? "";
}

function isValidIpv4(candidate: string): boolean {
  const match = /^(\d{1,3})(?:\.(\d{1,3})){3}$/.exec(candidate);
  if (!match) {
    return false;
  }

  return candidate
    .split(".")
    .every((part) => Number(part) >= 0 && Number(part) <= 255);
}

function isValidIpv6(candidate: string): boolean {
  if (!candidate.includes(":")) {
    return false;
  }

  try {
    const parsed = new URL(`http://[${candidate}]`);
    return (
      parsed.hostname.slice(1, -1).toLowerCase() === candidate.toLowerCase()
    );
  } catch {
    return false;
  }
}

function normalizeIpAddress(value: string | null | undefined): string | null {
  const forwardedValue = extractFirstForwardedToken(value?.trim() ?? "");
  if (!forwardedValue) {
    return null;
  }

  const candidate =
    forwardedValue.startsWith("[") && forwardedValue.endsWith("]")
      ? forwardedValue.slice(1, -1)
      : forwardedValue;

  if (isValidIpv4(candidate)) {
    return candidate;
  }

  if (isValidIpv6(candidate)) {
    return candidate.toLowerCase();
  }

  return null;
}

function hasTrustedProxyProvenance(
  request: Pick<Request, "headers">,
  headerName: string,
): boolean {
  if (canUseLocalhostSecurityFallbacks()) {
    return true;
  }

  const provenanceHeaders = getTrustedClientIpProvenanceHeaders(headerName);
  if (!provenanceHeaders || provenanceHeaders.length === 0) {
    return false;
  }

  return provenanceHeaders.some((provenanceHeader) => {
    const headerValue = request.headers.get(provenanceHeader)?.trim();
    return Boolean(headerValue);
  });
}

export function resolveVerifiedClientIp(
  request?: Pick<Request, "headers">,
): VerifiedClientIpResult {
  if (!request) {
    return canUseLocalhostSecurityFallbacks()
      ? {
          verified: true,
          ip: "127.0.0.1",
          source: "development_fallback",
        }
      : {
          verified: false,
          ip: null,
          source: null,
          reason: "missing_trusted_header",
        };
  }

  const allowLocalhostFallbacks = canUseLocalhostSecurityFallbacks();
  const trustedHeaders = getTrustedClientIpHeaderNames();
  const trustedBuiltInProxyFamily = resolveTrustedBuiltInProxyFamily();
  const presentBuiltInFamilies = new Set<BuiltInProxyFamily>();
  let sawTrustedHeader = false;
  let sawConflictingProxyFamilies = false;
  let sawHeaderWithoutProxyProvenance = false;
  let sawUntrustedProxyFamily = false;

  for (const headerName of trustedHeaders) {
    const headerValue = request.headers.get(headerName)?.trim();
    if (!headerValue) {
      continue;
    }

    const headerFamily = getTrustedClientIpHeaderFamily(headerName);
    if (headerFamily !== "custom") {
      presentBuiltInFamilies.add(headerFamily);
    }
  }

  if (!allowLocalhostFallbacks) {
    sawConflictingProxyFamilies = presentBuiltInFamilies.size > 1;
    sawUntrustedProxyFamily =
      !sawConflictingProxyFamilies &&
      presentBuiltInFamilies.size === 1 &&
      presentBuiltInFamilies.values().next().value !==
        trustedBuiltInProxyFamily;

    if (sawConflictingProxyFamilies || sawUntrustedProxyFamily) {
      return {
        verified: false,
        ip: null,
        source: null,
        reason: resolveVerifiedClientIpFailureReason({
          sawConflictingProxyFamilies,
          sawHeaderWithoutProxyProvenance: false,
          sawTrustedHeader: true,
          sawUntrustedProxyFamily,
        }),
      };
    }
  }

  for (const headerName of trustedHeaders) {
    const headerValue = request.headers.get(headerName)?.trim();
    if (!headerValue) {
      continue;
    }

    sawTrustedHeader = true;

    const headerFamily = getTrustedClientIpHeaderFamily(headerName);
    if (
      !allowLocalhostFallbacks &&
      headerFamily !== "custom" &&
      headerFamily !== trustedBuiltInProxyFamily
    ) {
      continue;
    }

    if (!hasTrustedProxyProvenance(request, headerName)) {
      sawHeaderWithoutProxyProvenance = true;
      continue;
    }

    const ip = normalizeIpAddress(headerValue);
    if (ip) {
      return { verified: true, ip, source: headerName };
    }
  }

  if (canUseLocalhostSecurityFallbacks()) {
    return {
      verified: true,
      ip: "127.0.0.1",
      source: "development_fallback",
    };
  }

  return {
    verified: false,
    ip: null,
    source: null,
    reason: resolveVerifiedClientIpFailureReason({
      sawConflictingProxyFamilies,
      sawHeaderWithoutProxyProvenance,
      sawTrustedHeader,
      sawUntrustedProxyFamily,
    }),
  };
}

function getRequestProofSecret(): string | null {
  return resolvePurposeScopedSigningSecret("request-proof");
}

function getIssuedRequestProofCookieName(): RequestProofCookieName {
  return isProduction()
    ? REQUEST_PROOF_COOKIE_NAME
    : LEGACY_REQUEST_PROOF_COOKIE_NAME;
}

function resolveRequestProofCookie(
  request?: Pick<Request, "headers">,
): ResolvedRequestProofCookie {
  const cookieHeader = request?.headers.get("cookie");
  if (!cookieHeader) {
    return {
      ambiguous: false,
      hasAnyCookieCandidate: false,
      hasLegacyCookie: false,
      source: null,
      value: null,
    };
  }

  const matchedCookies = new Map<RequestProofCookieName, string[]>();

  for (const entry of cookieHeader.split(";")) {
    const [rawName, ...rawValue] = entry.split("=");
    const normalizedName = rawName?.trim() as
      | RequestProofCookieName
      | undefined;

    if (
      !normalizedName ||
      !ACCEPTED_REQUEST_PROOF_COOKIE_NAMES.includes(normalizedName)
    ) {
      continue;
    }

    const existingValues = matchedCookies.get(normalizedName) ?? [];
    matchedCookies.set(normalizedName, [
      ...existingValues,
      rawValue.join("=").trim(),
    ]);
  }

  const hostCookieValues = matchedCookies.get(REQUEST_PROOF_COOKIE_NAME) ?? [];
  const legacyCookieValues =
    matchedCookies.get(LEGACY_REQUEST_PROOF_COOKIE_NAME) ?? [];
  const hostCookieValue = hostCookieValues[0] || null;
  const legacyCookieValue = legacyCookieValues[0] || null;
  const hasDuplicateCookieNames =
    hostCookieValues.length > 1 || legacyCookieValues.length > 1;
  const hasConflictingMigrationValues =
    Boolean(hostCookieValue) &&
    Boolean(legacyCookieValue) &&
    hostCookieValue !== legacyCookieValue;

  if (hasDuplicateCookieNames || hasConflictingMigrationValues) {
    return {
      ambiguous: true,
      hasAnyCookieCandidate: true,
      hasLegacyCookie: legacyCookieValues.length > 0,
      source: null,
      value: null,
    };
  }

  if (hostCookieValue) {
    return {
      ambiguous: false,
      hasAnyCookieCandidate: true,
      hasLegacyCookie: legacyCookieValues.length > 0,
      source: REQUEST_PROOF_COOKIE_NAME,
      value: hostCookieValue,
    };
  }

  if (legacyCookieValue) {
    return {
      ambiguous: false,
      hasAnyCookieCandidate: true,
      hasLegacyCookie: true,
      source: LEGACY_REQUEST_PROOF_COOKIE_NAME,
      value: legacyCookieValue,
    };
  }

  return {
    ambiguous: false,
    hasAnyCookieCandidate: false,
    hasLegacyCookie: false,
    source: null,
    value: null,
  };
}

async function verifyRequestProofTokenEnvelope(
  token: string | null | undefined,
): Promise<RequestProofEnvelopeVerificationResult> {
  if (!token) {
    return { valid: false, reason: "missing_token" };
  }

  const secret = getRequestProofSecret();
  if (!secret) {
    return { valid: false, reason: "missing_secret" };
  }

  const [payloadSegment, signatureSegment, ...rest] = token.split(".");
  if (!payloadSegment || !signatureSegment || rest.length > 0) {
    return { valid: false, reason: "malformed_token" };
  }

  const signatureIsValid = await verifyRequestProofSignature(
    payloadSegment,
    signatureSegment,
    secret,
  );
  if (!signatureIsValid) {
    return { valid: false, reason: "invalid_signature" };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(base64urlDecodeText(payloadSegment));
  } catch {
    return { valid: false, reason: "invalid_payload" };
  }

  if (!isRequestProofPayload(payload)) {
    return { valid: false, reason: "invalid_payload" };
  }

  if (payload.exp <= Date.now()) {
    return { valid: false, reason: "expired" };
  }

  return { valid: true, payload };
}

export function isRequestProofEnforced(): boolean {
  return !(process.env.NODE_ENV === "test" && !hasConfiguredRootApiSecret());
}

function normalizeUserAgent(value: string | null | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    return "missing";
  }

  return trimmed.slice(0, REQUEST_PROOF_USER_AGENT_MAX_LENGTH);
}

async function createRequestProofBindingHash(options: {
  label: "ip" | "ua";
  secret: string;
  value: string;
}): Promise<string> {
  return signRequestProofSegment(
    base64urlEncodeText(
      `${REQUEST_PROOF_VERSION}:${options.label}:${options.value}`,
    ),
    options.secret,
  );
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCodePoint(byte);
  }

  if (typeof btoa === "function") {
    return btoa(binary);
  }

  return Buffer.from(bytes).toString("base64");
}

function base64ToBytes(value: string): Uint8Array {
  if (typeof atob === "function") {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.codePointAt(i) ?? 0;
    }

    return bytes;
  }

  return Uint8Array.from(Buffer.from(value, "base64"));
}

function base64urlEncodeBytes(bytes: Uint8Array): string {
  let encoded = bytesToBase64(bytes).replaceAll("+", "-").replaceAll("/", "_");

  while (encoded.endsWith("=")) {
    encoded = encoded.slice(0, -1);
  }

  return encoded;
}

function base64urlEncodeText(value: string): string {
  return base64urlEncodeBytes(textEncoder.encode(value));
}

function base64urlDecodeBytes(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) {
    return null;
  }

  const padded = value
    .replaceAll("-", "+")
    .replaceAll("_", "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");

  try {
    return base64ToBytes(padded);
  } catch {
    return null;
  }
}

function base64urlDecodeText(value: string): string {
  const decodedBytes = base64urlDecodeBytes(value);
  if (!decodedBytes) {
    throw new Error("Invalid base64url payload segment");
  }

  return textDecoder.decode(decodedBytes);
}

function cloneBytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

async function getRequestProofCryptoKey(secret: string): Promise<CryptoKey> {
  let cached = requestProofKeyCache.get(secret);
  if (!cached) {
    cached = crypto.subtle.importKey(
      "raw",
      textEncoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"],
    );
    requestProofKeyCache.set(secret, cached);
  }

  return cached;
}

async function signRequestProofSegment(
  payloadSegment: string,
  secret: string,
): Promise<string> {
  const key = await getRequestProofCryptoKey(secret);
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    textEncoder.encode(payloadSegment),
  );

  return base64urlEncodeBytes(new Uint8Array(signature));
}

async function verifyRequestProofSignature(
  payloadSegment: string,
  signatureSegment: string,
  secret: string,
): Promise<boolean> {
  const signatureBytes = base64urlDecodeBytes(signatureSegment);
  if (!signatureBytes) {
    return false;
  }

  const key = await getRequestProofCryptoKey(secret);
  const signatureBuffer = cloneBytesToArrayBuffer(signatureBytes);

  try {
    return await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBuffer,
      textEncoder.encode(payloadSegment),
    );
  } catch {
    return false;
  }
}

function isRequestProofPayload(value: unknown): value is RequestProofPayload {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<RequestProofPayload>;
  return (
    candidate.v === REQUEST_PROOF_VERSION &&
    typeof candidate.ipHash === "string" &&
    candidate.ipHash.length > 0 &&
    typeof candidate.uaHash === "string" &&
    candidate.uaHash.length > 0 &&
    typeof candidate.exp === "number" &&
    Number.isFinite(candidate.exp)
  );
}

export async function createRequestProofToken(options: {
  expiresAtMs?: number;
  ip: string;
  userAgent?: string | null;
}): Promise<string | null> {
  const secret = getRequestProofSecret();
  if (!secret) {
    return null;
  }

  const normalizedUserAgent = normalizeUserAgent(options.userAgent);
  const [ipHash, uaHash] = await Promise.all([
    createRequestProofBindingHash({
      label: "ip",
      secret,
      value: options.ip,
    }),
    createRequestProofBindingHash({
      label: "ua",
      secret,
      value: normalizedUserAgent,
    }),
  ]);

  const payload: RequestProofPayload = {
    v: REQUEST_PROOF_VERSION,
    ipHash,
    uaHash,
    exp: Math.trunc(
      options.expiresAtMs ?? Date.now() + REQUEST_PROOF_TTL_SECONDS * 1000,
    ),
  };
  const payloadSegment = base64urlEncodeText(JSON.stringify(payload));
  const signatureSegment = await signRequestProofSegment(
    payloadSegment,
    secret,
  );

  return `${payloadSegment}.${signatureSegment}`;
}

export async function createRequestProofCookie(options: {
  expiresAtMs?: number;
  ip: string;
  userAgent?: string | null;
}): Promise<{
  httpOnly: true;
  maxAge: number;
  name: string;
  path: string;
  sameSite: "strict";
  secure: boolean;
  value: string;
} | null> {
  const token = await createRequestProofToken(options);
  if (!token) {
    return null;
  }

  const cookieName = getIssuedRequestProofCookieName();

  return {
    name: cookieName,
    value: token,
    httpOnly: true,
    sameSite: "strict",
    secure: cookieName === REQUEST_PROOF_COOKIE_NAME,
    path: "/",
    maxAge: REQUEST_PROOF_TTL_SECONDS,
  };
}

export function getRequestProofCookie(
  request?: Pick<Request, "headers">,
): string | null {
  const resolvedCookie = resolveRequestProofCookie(request);
  if (resolvedCookie.ambiguous) {
    return null;
  }

  return resolvedCookie.value;
}

export function hasLegacyRequestProofCookie(
  request?: Pick<Request, "headers">,
): boolean {
  return resolveRequestProofCookie(request).hasLegacyCookie;
}

export function hasAnyRequestProofCookieCandidate(
  request?: Pick<Request, "headers">,
): boolean {
  return resolveRequestProofCookie(request).hasAnyCookieCandidate;
}

export function getRequestProofCookieNamesForCleanup(): readonly string[] {
  return ACCEPTED_REQUEST_PROOF_COOKIE_NAMES;
}

export async function isServerIssuedRequestProofToken(
  token: string | null | undefined,
): Promise<boolean> {
  const verification = await verifyRequestProofTokenEnvelope(token);
  return verification.valid;
}

export async function verifyRequestProofToken(
  token: string | null | undefined,
  options: {
    ip: string;
    userAgent?: string | null;
  },
): Promise<RequestProofVerificationResult> {
  if (!isRequestProofEnforced()) {
    return { valid: true, reason: "test_bypass" };
  }

  const secret = getRequestProofSecret();
  if (!secret) {
    return { valid: false, reason: "missing_secret" };
  }

  const envelopeVerification = await verifyRequestProofTokenEnvelope(token);
  if (!envelopeVerification.valid) {
    return envelopeVerification;
  }

  const normalizedUserAgent = normalizeUserAgent(options.userAgent);
  const payload = envelopeVerification.payload;

  const [expectedIpHash, expectedUaHash] = await Promise.all([
    createRequestProofBindingHash({
      label: "ip",
      secret,
      value: options.ip,
    }),
    createRequestProofBindingHash({
      label: "ua",
      secret,
      value: normalizedUserAgent,
    }),
  ]);

  if (payload.ipHash !== expectedIpHash) {
    return { valid: false, reason: "ip_mismatch" };
  }

  if (payload.uaHash !== expectedUaHash) {
    return { valid: false, reason: "user_agent_mismatch" };
  }

  return { valid: true, payload };
}
