/**
 * Routes rendered on the shared paper surface.
 *
 * These pages paint the paper ground themselves, so the chrome above them has
 * to switch to the paper palette or the seam between the two shows.
 *
 * @param pathname - The current `usePathname()` value.
 * @source
 */
export function isPaperPage(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return pathname === "/" || pathname === "/examples";
}
