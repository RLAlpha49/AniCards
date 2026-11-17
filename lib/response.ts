/**
 * Reading a `Response` body and turning a failed status into a message.
 * @source
 */
/**
 * Try to parse a Response body as JSON; if that fails, return the text body.
 * If both attempts fail, return null.
 * @source
 */
export async function parseResponsePayload(
  response: Response,
): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    try {
      // Clone so reading text does not consume the original stream more than once.
      return await response.clone().text();
    } catch {
      return null;
    }
  }
}

/**
 * Create a human-friendly error message from the HTTP response and optional payload.
 * If the payload contains an `error` or `message` field those are prioritized.
 * @source
 */
export function getResponseErrorMessage(
  response: Response,
  payload: unknown,
): string {
  let message = `HTTP ${response.status} ${response.statusText}`;
  if (!payload) return message;
  if (typeof payload === "object" && payload !== null) {
    const obj = payload as Record<string, unknown>;
    if (typeof obj.error === "string" && obj.error.trim()) return obj.error;
    if (typeof obj.message === "string" && obj.message.trim())
      return obj.message;
  }
  if (typeof payload === "string" && payload.trim()) return payload;
  return message;
}
