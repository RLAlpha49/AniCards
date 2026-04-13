const DEFAULT_TRUSTED_CLIENT_IP_HEADERS = [
  "x-vercel-forwarded-for",
  "cf-connecting-ip",
] as const;

const DEFAULT_TRUSTED_CLIENT_IP_PROVENANCE_HEADERS = {
  "x-vercel-forwarded-for": ["x-vercel-id"],
  "cf-connecting-ip": ["cf-ray"],
} as const satisfies Record<
  (typeof DEFAULT_TRUSTED_CLIENT_IP_HEADERS)[number],
  readonly string[]
>;

const PLAYWRIGHT_TRUSTED_CLIENT_IP_HEADER = "x-playwright-client-ip";

const DEVELOPMENT_REQUEST_PROOF_SECRET = "anicards-dev-request-proof-secret";
const REQUEST_PROOF_VERSION = 1;
const REQUEST_PROOF_USER_AGENT_MAX_LENGTH = 240;

export const REQUEST_PROOF_COOKIE_NAME = "anicards_request_proof";
export const REQUEST_PROOF_TTL_SECONDS = 4 * 60 * 60;

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
        | "invalid_trusted_header"
        | "missing_proxy_provenance"
        | "missing_trusted_header";
      source: null;
      verified: false;
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

function isExplicitAutomationClientIpHeaderAllowed(
  headerName: string,
): boolean {
  return (
    process.env.PLAYWRIGHT_REAL_USER_E2E === "1" &&
    headerName === PLAYWRIGHT_TRUSTED_CLIENT_IP_HEADER
  );
}

export function getTrustedClientIpHeaderNames(): string[] {
  const rawConfigured = process.env.TRUSTED_CLIENT_IP_HEADERS?.trim();
  if (!rawConfigured) {
    return [...DEFAULT_TRUSTED_CLIENT_IP_HEADERS];
  }

  const configured = rawConfigured
    .split(",")
    .map((value) => normalizeHeaderName(value))
    .filter((value): value is string => value !== null);

  return configured.length > 0
    ? Array.from(new Set(configured))
    : [...DEFAULT_TRUSTED_CLIENT_IP_HEADERS];
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
  if (!isProduction()) {
    return true;
  }

  if (isExplicitAutomationClientIpHeaderAllowed(headerName)) {
    return true;
  }

  const provenanceHeaders =
    DEFAULT_TRUSTED_CLIENT_IP_PROVENANCE_HEADERS[
      headerName as keyof typeof DEFAULT_TRUSTED_CLIENT_IP_PROVENANCE_HEADERS
    ];

  if (!provenanceHeaders) {
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
    return isProduction()
      ? {
          verified: false,
          ip: null,
          source: null,
          reason: "missing_trusted_header",
        }
      : {
          verified: true,
          ip: "127.0.0.1",
          source: "development_fallback",
        };
  }

  const trustedHeaders = getTrustedClientIpHeaderNames();
  let sawTrustedHeader = false;
  let sawHeaderWithoutProxyProvenance = false;

  for (const headerName of trustedHeaders) {
    const headerValue = request.headers.get(headerName)?.trim();
    if (!headerValue) {
      continue;
    }

    sawTrustedHeader = true;

    if (!hasTrustedProxyProvenance(request, headerName)) {
      sawHeaderWithoutProxyProvenance = true;
      continue;
    }

    const ip = normalizeIpAddress(headerValue);
    if (ip) {
      return { verified: true, ip, source: headerName };
    }
  }

  if (!isProduction()) {
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
    reason: sawHeaderWithoutProxyProvenance
      ? "missing_proxy_provenance"
      : sawTrustedHeader
        ? "invalid_trusted_header"
        : "missing_trusted_header",
  };
}

function getRequestProofSecret(): string | null {
  const configuredSecret = process.env.API_SECRET_TOKEN?.trim();
  if (configuredSecret) {
    return configuredSecret;
  }

  if (!isProduction()) {
    return DEVELOPMENT_REQUEST_PROOF_SECRET;
  }

  return null;
}

export function isRequestProofEnforced(): boolean {
  return !(
    process.env.NODE_ENV === "test" && !process.env.API_SECRET_TOKEN?.trim()
  );
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

  return new Uint8Array(Buffer.from(value, "base64"));
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

function base64urlDecodeText(value: string): string {
  const padded = value
    .replaceAll("-", "+")
    .replaceAll("_", "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  return textDecoder.decode(base64ToBytes(padded));
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

  return {
    name: REQUEST_PROOF_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "strict",
    secure: isProduction(),
    path: "/",
    maxAge: REQUEST_PROOF_TTL_SECONDS,
  };
}

export function getRequestProofCookie(
  request?: Pick<Request, "headers">,
): string | null {
  const cookieHeader = request?.headers.get("cookie");
  if (!cookieHeader) {
    return null;
  }

  for (const entry of cookieHeader.split(";")) {
    const [rawName, ...rawValue] = entry.split("=");
    if (rawName?.trim() !== REQUEST_PROOF_COOKIE_NAME) {
      continue;
    }

    return rawValue.join("=").trim() || null;
  }

  return null;
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

  if (!token) {
    return { valid: false, reason: "missing_token" };
  }

  const [payloadSegment, signatureSegment, ...rest] = token.split(".");
  if (!payloadSegment || !signatureSegment || rest.length > 0) {
    return { valid: false, reason: "malformed_token" };
  }

  const expectedSignature = await signRequestProofSegment(
    payloadSegment,
    secret,
  );
  if (expectedSignature !== signatureSegment) {
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

  const normalizedUserAgent = normalizeUserAgent(options.userAgent);

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
