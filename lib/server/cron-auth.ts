import { createHash, timingSafeEqual } from "node:crypto";
import { apiJsonHeaders } from "@/lib/api-utils";

/**
 * Whether to accept unauthenticated cron calls because no secret is set.
 *
 * This used to follow `NODE_ENV` alone, which meant any deployment running in
 * development mode accepted unauthenticated calls on routes that can delete a
 * stored user and its card keys. It is now an explicit opt-in. Keep it unset
 * unless the machine is a local development box.
 * @source
 */
function allowsUnauthenticatedDevelopmentCalls(): boolean {
  return (
    process.env.CRON_SECRET_DEV_BYPASS === "true" &&
    process.env.NODE_ENV === "development"
  );
}

/**
 * Compares the presented cron secret against the configured one without
 * letting the comparison time depend on how many leading characters match.
 * Both values are hashed first, so the comparison always covers 32 bytes and
 * no length information leaks either.
 * @param presented - Value of the x-cron-secret header, if any.
 * @returns True when the presented secret matches the configured one.
 * @source
 */
function cronSecretMatches(presented: string | null): boolean {
  const configuredSecret = process.env.CRON_SECRET ?? "";
  const configuredDigest = createHash("sha256")
    .update(configuredSecret)
    .digest();
  const presentedDigest = createHash("sha256")
    .update(presented ?? "")
    .digest();
  return timingSafeEqual(configuredDigest, presentedDigest);
}

/**
 * Authorizes a cron request against the configured shared secret.
 *
 * QStash schedules forward `x-cron-secret`, and the same header keeps a
 * manual invocation possible from a terminal. The dispatcher and the
 * per-user consumer share this check so both accept and reject the same
 * requests.
 *
 * @param request - Incoming request whose headers carry the secret.
 * @returns A response when the request must be rejected, or null when it may
 *   proceed.
 * @source
 */
export function authorizeCronRequest(request: Request): Response | null {
  const cronSecret = process.env.CRON_SECRET;
  const cronSecretHeader = request.headers.get("x-cron-secret");

  if (!cronSecret) {
    if (!allowsUnauthenticatedDevelopmentCalls()) {
      console.error("🔒 [Cron] CRON_SECRET is not configured");
      return new Response("Cron authorization is not configured", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
    console.warn(
      "[Cron] CRON_SECRET is not configured. CRON_SECRET_DEV_BYPASS=true is set, so authorization is skipped in development.",
    );
    return null;
  }

  if (!cronSecretMatches(cronSecretHeader)) {
    console.error("🔒 [Cron] Unauthorized: Invalid Cron secret");
    return new Response("Unauthorized", {
      status: 401,
      headers: apiJsonHeaders(request),
    });
  }

  return null;
}
