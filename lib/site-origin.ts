/**
 * The public site origin and the API hosts that must never be mistaken for it.
 *
 * Two copies of this logic existed: a build-time one in `next.config.ts` and a
 * runtime one in `lib/api-utils.ts`. They drifted, and the build-time copy
 * carried a guard the runtime copy lacked. Both now import from here.
 *
 * The module is deliberately dependency-free and alias-free so
 * `next.config.ts` can import it by relative path; Next bundles the config
 * without resolving `@/`.
 *
 * @source
 */

/**
 * Public site origin used when `NEXT_PUBLIC_SITE_URL` is unset or unusable.
 * @source
 */
export const DEFAULT_SITE_ORIGIN = "https://anicards.alpha49.com";

/** Production host that serves the API. @source */
export const API_HOST = "api.anicards.alpha49.com";

/** Development hosts that stand in for the API host. @source */
export const DEV_API_HOSTS = [
  "api.localhost",
  "api.lvh.me",
  "api.anicards.localhost",
  "api.anicards.lvh.me",
  "api.anicards.test",
];

/**
 * Every host the API is served on.
 *
 * Host conditions match the `Host` header with its port removed, so a
 * `host:3000` value would never match. One entry per host covers every port.
 * @source
 */
export const API_HOSTS = [API_HOST, ...DEV_API_HOSTS];

/**
 * Reduces a configured URL to its origin.
 *
 * @param value - Configured URL, or undefined when nothing is set.
 * @returns The origin, or null when the value is missing or unparseable.
 * @source
 */
export function normalizeOrigin(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/**
 * Resolves the public site origin.
 *
 * Read from `NEXT_PUBLIC_SITE_URL` at call time so a test or a script can set
 * the variable after this module is loaded. A value that points at an API host
 * is ignored, because the API host redirects to the site origin and a site
 * origin equal to the API host would redirect to itself.
 *
 * @returns A parseable origin with a non-API host. Never empty, because a
 *   misconfigured value falls back to the default rather than to an empty
 *   string that no browser would match.
 * @source
 */
export function resolveSiteOrigin(): string {
  const origin = normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL);
  if (!origin) return DEFAULT_SITE_ORIGIN;

  return API_HOSTS.includes(new URL(origin).hostname)
    ? DEFAULT_SITE_ORIGIN
    : origin;
}
