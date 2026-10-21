/**
 * The home route paints its own paper ground, so the shared site chrome
 * (header, footer, GitHub button) adopts the paper palette there while every
 * other page keeps the default look.
 *
 * @source
 */
export function isHomePage(pathname: string | null | undefined): boolean {
  return pathname === "/";
}
