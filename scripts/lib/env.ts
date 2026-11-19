/**
 * Helpers shared by the operator scripts.
 *
 * Each of these existed in two or three copies, once per script that needed
 * it. The copies had already drifted in wording and would have drifted in
 * behaviour, so they live here now.
 *
 * @source
 */

/**
 * Reads a required environment variable.
 *
 * @param name - Variable name.
 * @returns Its value.
 * @throws {Error} When the variable is unset or empty.
 * @source
 */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set.`);
  return value;
}

/**
 * Loads `.env` from the working directory.
 *
 * A plain `node script.ts` invocation does not read `.env`, so every required
 * variable would look missing. Bun loads it on its own, and loading it again
 * is harmless because an existing value is never overwritten. A missing file
 * is not an error, so an operator who exports the variables can still run the
 * script.
 *
 * @source
 */
export function loadDotEnv(): void {
  try {
    process.loadEnvFile();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

/** Loopback hostnames a local Docker stack listens on. @source */
const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1"]);

/**
 * Refuses a non-local Redis URL.
 *
 * The database scripts write data that is meant to be discarded, so pointing
 * one at production would be destructive. The Compose REST proxy is accepted
 * as well as a loopback host, because inside the Compose network the proxy is
 * the local database and its hostname does not resolve to a loopback address.
 *
 * @param url - Configured REST URL.
 * @param action - Verb for the refusal message, for example "reset".
 * @source
 */
export function assertLocalRedis(url: string, action: string): void {
  const parsed = new URL(url);
  const isHostLoopback = LOOPBACK_HOSTNAMES.has(parsed.hostname);
  const isComposeProxy =
    parsed.hostname === "serverless-redis-http" &&
    (parsed.port === "" || parsed.port === "80");
  if (
    parsed.protocol !== "http:" ||
    (!(isHostLoopback && parsed.port) && !isComposeProxy)
  ) {
    throw new Error(
      `Refusing to ${action} non-local Redis URL: ${url}. Expected a loopback address or the Compose Redis proxy.`,
    );
  }
}
