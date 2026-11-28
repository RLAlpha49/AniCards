/**
 * Resolution of the public API origin.
 *
 * Use these helpers when you explicitly want to target the public API host.
 * For in-app Next.js API routes, prefer a relative path (for example
 * "/api/get-user?userId=...") to avoid an extra network hop or a cross-origin
 * call during local development.
 * @source
 */
const _envApiBase =
  typeof process === "undefined" ? undefined : process.env?.NEXT_PUBLIC_API_URL;

export function resolveApiBase(url?: string): string {
  if (!url) return "https://api.anicards.alpha49.com";
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.startsWith("api.")) {
      parsed.hostname = `api.${parsed.hostname}`;
    }
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return "https://api.anicards.alpha49.com";
  }
}

export const API_BASE: string = resolveApiBase(_envApiBase);

/**
 * Build an absolute URL targeting the public API base.
 *
 * This helper resolves the configured `NEXT_PUBLIC_API_URL` (defaulting to
 * the public API host) and appends the provided path to produce an absolute
 * URL. Use this when you explicitly want to target the public API host
 * (e.g. a separate API origin or CDN-backed endpoint).
 *
 * If you intend to call in-app Next.js API routes (handled by this application),
 * prefer a relative path (for example "/api/get-user?userId=...") to avoid an extra
 * network hop or cross-origin call during local development.
 */
export function buildApiUrl(path: string): string {
  if (!path) path = "";
  if (/^https?:\/\//i.test(path)) return path;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${normalized}`;
}
