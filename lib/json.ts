import { createLogger } from "@/lib/log";

const log = createLogger("json");

/**
 * JSON parsing with a diagnostic on failure.
 * @source
 */
/**
 * Safely parses a JSON string into an object of type T.
 *
 * If the input is a string, it attempts to parse it as JSON. If parsing fails, it logs an error and throws the exception.
 * If the input is not a string, it is assumed to already be parsed and is returned as-is.
 *
 * @param data - The data to parse, which may be a JSON string or an already-parsed object.
 * @param context - Optional human-friendly label used in logs to indicate parse context.
 * @returns The parsed object of type T.
 * @throws Error if JSON.parse fails.
 * @source
 */
export function safeParse<T>(data: unknown, context?: string): T {
  if (typeof data !== "string") return data as T;
  const logParseError = (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    const isProduction =
      typeof process !== "undefined" && process.env?.NODE_ENV === "production";

    const maxSnippet = 200;
    const length = data.length;
    const ctxLabel = context ? ` [${context}]` : "";
    if (isProduction) {
      log.error(
        `Failed to parse JSON${ctxLabel}: ${message}. Payload length: ${length}`,
      );
      return;
    }

    const snippet = data.slice(0, maxSnippet);
    const truncated = length > maxSnippet ? "..." : "";
    log.error(
      `Failed to parse JSON${ctxLabel}: ${message}. Payload snippet (first ${Math.min(
        maxSnippet,
        length,
      )} chars, length ${length}): ${snippet}${truncated}`,
    );
  };

  try {
    return JSON.parse(data);
  } catch (error) {
    logParseError(error);
    throw error;
  }
}
