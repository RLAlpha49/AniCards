/**
 * Helpers that only resolve inside a browser: absolute URLs and the async
 * clipboard.
 * @source
 */
/**
 * Copies the specified text to the system clipboard.
 *
 * A simple wrapper around the browser's clipboard API that returns a promise.
 *
 * @param text - The text to be copied.
 * @returns A Promise that resolves when the text is successfully copied.
 * @source
 */
export function copyToClipboard(text: string): Promise<void> {
  // Utilize the browser's native clipboard API.
  return navigator.clipboard.writeText(text);
}

/**
 * Converts a relative URL to an absolute URL if needed.
 *
 * This utility is useful for ensuring URLs are absolute when sharing or embedding images,
 * particularly for client-side operations where the window object is available.
 *
 * @param url - The URL to convert (may be relative or absolute).
 * @returns The absolute URL. If already absolute or running on server, returns the original URL.
 * @source
 */
export function getAbsoluteUrl(url: string): string {
  if (!globalThis.window) return url;
  if (url.startsWith("http")) return url;
  return `${globalThis.window.location.origin}${url}`;
}
