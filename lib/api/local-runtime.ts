import { createHmac } from "node:crypto";

export const ALLOW_INSECURE_LOCALHOST_SECRETS_ENV =
  "ALLOW_INSECURE_LOCALHOST_SECRETS";

const INSECURE_LOCALHOST_SIGNING_SECRET_ROOT =
  "anicards-insecure-localhost-signing-secret";

type PurposeScopedSecret = "request-proof" | "protected-write-grant";

function readBooleanEnvValue(value: string | undefined): boolean | undefined {
  const normalized = value?.trim().toLowerCase();

  if (normalized === "true") {
    return true;
  }

  if (normalized === "false" || normalized === "") {
    return false;
  }

  return undefined;
}

function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();

  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized === "[::1]"
  );
}

function isLoopbackHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);

    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      isLoopbackHostname(url.hostname)
    );
  } catch {
    return false;
  }
}

function getConfiguredPublicRuntimeUrls(
  env: NodeJS.ProcessEnv,
): readonly string[] {
  return [
    env.NEXT_PUBLIC_APP_URL,
    env.NEXT_PUBLIC_API_URL,
    env.NEXT_PUBLIC_SITE_URL,
  ]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
}

export function hasConfiguredRootApiSecret(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return Boolean(env.API_SECRET_TOKEN?.trim());
}

export function isLocalhostDevelopmentRuntime(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (env.NODE_ENV !== "development") {
    return false;
  }

  if (env.VERCEL?.trim() || env.VERCEL_URL?.trim()) {
    return false;
  }

  const configuredUrls = getConfiguredPublicRuntimeUrls(env);
  return configuredUrls.length > 0 && configuredUrls.every(isLoopbackHttpUrl);
}

export function canUseLocalhostSecurityFallbacks(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.NODE_ENV === "test" || isLocalhostDevelopmentRuntime(env);
}

export function isInsecureLocalhostSigningSecretAllowed(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (env.NODE_ENV === "test") {
    return true;
  }

  return (
    isLocalhostDevelopmentRuntime(env) &&
    readBooleanEnvValue(env[ALLOW_INSECURE_LOCALHOST_SECRETS_ENV]) === true
  );
}

export function derivePurposeScopedSecret(
  rootSecret: string,
  purpose: PurposeScopedSecret,
): string {
  return createHmac("sha256", rootSecret)
    .update(`anicards:${purpose}:v1`)
    .digest("base64url");
}

export function resolvePurposeScopedSigningSecret(
  purpose: PurposeScopedSecret,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const configuredRootSecret = env.API_SECRET_TOKEN?.trim();
  if (configuredRootSecret) {
    return derivePurposeScopedSecret(configuredRootSecret, purpose);
  }

  if (isInsecureLocalhostSigningSecretAllowed(env)) {
    return derivePurposeScopedSecret(
      INSECURE_LOCALHOST_SIGNING_SECRET_ROOT,
      purpose,
    );
  }

  return null;
}
