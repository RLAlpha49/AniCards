/**
 * Turns the forwarded headers of a request into one caller address.
 *
 * The address keys the rate limiter and the request log. IPv4 fixes are
 * canonicalised and IPv6 literals are validated before either is returned.
 * @source
 */
import { after } from "next/server";

/**
 * Rate-limit identifier used when a request carries no usable client address.
 *
 * One constant is deliberate: a request whose address cannot be read is still
 * limited, and every such request shares a bucket instead of each getting a
 * fresh counter of its own. The value is the loopback address, which is what a
 * request on a local development server reports.
 * @source
 */
const FALLBACK_CLIENT_IP = "127.0.0.1";

/**
 * Headers consulted for the client address when nothing overrides them.
 *
 * Vercel sets `x-forwarded-for` at its edge, so the leftmost entry is the
 * client address there. `TRUSTED_CLIENT_IP_HEADERS` replaces this list for a
 * deployment that sits behind another proxy or CDN.
 * @source
 */
const DEFAULT_CLIENT_IP_HEADERS = ["x-forwarded-for"];

/**
 * Reads the header names this deployment trusts to carry the client address.
 *
 * Resolved at call time rather than at import time so a test or a script can
 * set the variable after this module is loaded. A value that yields no names
 * falls back to the default rather than disabling the lookup.
 * @returns Lower-cased header names, in preference order.
 * @source
 */
function getTrustedClientIpHeaders(): string[] {
  const configured = process.env.TRUSTED_CLIENT_IP_HEADERS;
  if (!configured) return DEFAULT_CLIENT_IP_HEADERS;
  const names = configured
    .split(",")
    .map((name) => name.trim().toLowerCase())
    .filter((name) => name.length > 0);
  return names.length > 0 ? names : DEFAULT_CLIENT_IP_HEADERS;
}

/**
 * Rewrites an IPv4 dotted quad into one canonical spelling.
 *
 * `01.2.3.4` and `1.2.3.4` name the same host, and a limiter keyed on the raw
 * text would count them as two callers. Octets are compared as numbers so
 * every spelling of an address lands in one bucket.
 * @param value - Candidate address.
 * @returns The canonical form, or null when the text is not an IPv4 address.
 * @source
 */
function normalizeIpv4(value: string): string | null {
  const octets = value.split(".");
  if (octets.length !== 4) return null;
  const parsed: number[] = [];
  for (const octet of octets) {
    if (!/^\d{1,3}$/.test(octet)) return null;
    const numeric = Number(octet);
    if (numeric > 255) return null;
    parsed.push(numeric);
  }
  return parsed.join(".");
}

/**
 * Validates an IPv6 literal and lower-cases it.
 *
 * Expanding the address to eight groups is not needed: the identifier only has
 * to be stable. An embedded IPv4 tail such as `::ffff:1.2.3.4` is rejected
 * because forwarded headers from the platforms this app deploys to do not
 * carry one, and accepting a shape that is only partly checked would be worse
 * than rejecting it.
 * @param value - Candidate address.
 * @returns The lower-cased literal, or null when the text is not IPv6.
 * @source
 */
function normalizeIpv6(value: string): string | null {
  const lower = value.toLowerCase();
  if (!lower.includes(":")) return null;
  if (!/^[0-9a-f:]+$/.test(lower)) return null;
  const compressed = lower.split("::").length - 1;
  if (compressed > 1) return null;
  const groups = lower.split(":").filter((group) => group.length > 0);
  if (!groups.every((group) => /^[0-9a-f]{1,4}$/.test(group))) return null;
  // `::` stands in for at least one zero group, so a compressed address cannot
  // already hold all eight of them.
  if (compressed === 1 ? groups.length >= 8 : groups.length !== 8) return null;
  return lower;
}

/**
 * Reads the client address from one forwarded header value.
 *
 * A forwarded header is a comma-separated chain, and the leftmost entry is the
 * original client on every platform this app runs on. Using the whole chain as
 * the limiter identifier let one caller appear as many, so only the first
 * entry is parsed, then validated as an IP literal so an arbitrary header
 * value cannot become an identifier.
 * @param header - Raw header value, possibly a list of addresses.
 * @returns The normalized address, or null when the first entry is not an IP.
 * @source
 */
function parseClientIp(header: string): string | null {
  const first = header.split(",")[0]?.trim() ?? "";
  if (!first) return null;
  // Proxies may bracket an IPv6 literal and append the transport port.
  const bracketed = /^\[([^\]]+)\](?::\d+)?$/.exec(first);
  const candidate = bracketed?.[1] ?? first;
  // An IPv4 literal followed by a port carries the port outside the address.
  const withoutPort = /^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/.exec(candidate);
  const address = withoutPort?.[1] ?? candidate;
  // A zone index is link-local routing, not part of the caller's identity.
  const zone = address.indexOf("%");
  const literal = zone === -1 ? address : address.slice(0, zone);
  return normalizeIpv4(literal) ?? normalizeIpv6(literal);
}

/**
 * Resolves the address that identifies a caller for rate limiting and logs.
 *
 * The identifier has to stay stable for one caller and be impossible to vary
 * at will, because each new identifier buys a fresh rate-limit counter and its
 * own key. Reading the first entry of a trusted forwarded header, validating
 * it as an IP literal and normalizing its spelling gives exactly one key per
 * address. `TRUSTED_CLIENT_IP_HEADERS` names the headers this deployment
 * trusts, in preference order; when it is unset only `x-forwarded-for` is
 * read.
 *
 * When no trusted header carries a usable address the caller is still limited,
 * under the single shared {@link FALLBACK_CLIENT_IP} bucket.
 * @param request - Request whose headers are read.
 * @returns A normalized IP literal, or the fallback address.
 * @source
 */
export function getClientIp(request: Request | undefined): string {
  if (!request) return FALLBACK_CLIENT_IP;
  for (const name of getTrustedClientIpHeaders()) {
    const header = request.headers.get(name);
    if (!header) continue;
    const ip = parseClientIp(header);
    if (ip) return ip;
  }
  return FALLBACK_CLIENT_IP;
}
