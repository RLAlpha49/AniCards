"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/lib/navigation";
import { Menu } from "@/lib/icons";
import { trackNavigation, safeTrack } from "@/lib/utils/google-analytics";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/Sheet";

/**
 * Reports a masthead navigation click to analytics.
 *
 * @param title - The nav item's title, used as the destination.
 * @source
 */
function trackNavClick(title: string): void {
  safeTrack(() => trackNavigation(title.toLowerCase(), "masthead"));
}

/**
 * Returns true when the given nav href is the current page. *
 * `/` only matches exactly so the home link is not marked active everywhere.
 *
 * @param href - The nav item's target path.
 * @param pathname - The current `usePathname()` value.
 * @source
 */
function isActiveHref(
  href: string,
  pathname: string | null | undefined,
): boolean {
  if (!pathname) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Horizontal masthead navigation for desktop.
 *
 * The links sit beside the brand in the header, with the active page marked by
 * a rule rather than a filled pill. The default theme keeps the gradient
 * treatment used elsewhere in the app.
 *
 * @param props.home - Whether the paper palette is active.
 * @source
 */
export function MastheadNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
      {NAV_ITEMS.map((item) => {
        const active = isActiveHref(item.href, pathname);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            onClick={() => trackNavClick(item.title)}
            className={cn(
              "relative px-2.5 py-2 text-sm font-medium transition-colors",
              active
                ? "text-[#b83a24] dark:text-[#d4573c]"
                : "text-[#4d443a] hover:text-[#191512] dark:text-[#b6a88f] dark:hover:text-[#ece1c9]",
            )}
          >
            {item.title}
            <span
              aria-hidden="true"
              className={cn(
                "absolute inset-x-2.5 -bottom-0.5 h-[2px] transition-opacity",
                "bg-[#b83a24] dark:bg-[#d4573c]",
                active ? "opacity-100" : "opacity-0",
              )}
            />
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Compact navigation trigger that opens the full menu in a sheet.
 *
 * Shown below the `lg` breakpoint, where the masthead links no longer fit.
 *
 * @param props.home - Whether the paper palette is active.
 * @source
 */
export function MastheadMenu() {
  const pathname = usePathname();

  return (
    <Sheet>
      <SheetTrigger
        aria-label="Open navigation menu"
        className={cn(
          "inline-grid h-9 w-9 place-items-center border transition-colors lg:hidden",
          "rounded-none border-[#191512]/45 text-[#191512] hover:bg-[#191512] hover:text-[#f3e9d5] dark:border-[#ece1c9]/45 dark:text-[#ece1c9] dark:hover:bg-[#ece1c9] dark:hover:text-[#16120f]",
        )}
      >
        <Menu className="h-5 w-5" />
      </SheetTrigger>

      <SheetContent
        side="right"
        className={cn(
          "w-[min(20rem,85vw)] border-l p-0",
          "border-[#191512]/25 bg-[#f3e9d5] dark:border-[#ece1c9]/25 dark:bg-[#16120f]",
        )}
      >
        <SheetTitle
          className={cn(
            "border-b px-5 py-4 text-xs font-semibold tracking-[0.24em] uppercase",
            "border-[#191512]/20 font-[family-name:var(--font-display)] text-[#4d443a] dark:border-[#ece1c9]/20 dark:text-[#b6a88f]",
          )}
        >
          Navigation
        </SheetTitle>

        <nav aria-label="Main (mobile)" className="flex flex-col py-2">
          {NAV_ITEMS.map((item, index) => {
            const active = isActiveHref(item.href, pathname);

            return (
              <SheetClose asChild key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => trackNavClick(item.title)}
                  className={cn(
                    "flex items-center gap-3 px-5 py-3 text-sm font-medium transition-colors",
                    cn(
                      "border-b border-[#191512]/10 dark:border-[#ece1c9]/10",
                      active
                        ? "text-[#b83a24] dark:text-[#d4573c]"
                        : "text-[#4d443a] hover:text-[#191512] dark:text-[#b6a88f] dark:hover:text-[#ece1c9]",
                    ),
                  )}
                >
                  <item.icon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      "text-[#b83a24] dark:text-[#d4573c]",
                    )}
                  />
                  <span className="flex-1">{item.title}</span>
                  <span
                    aria-hidden="true"
                    className={cn(
                      "text-[0.62rem] tracking-[0.2em]",
                      "text-[#4d443a]/60 dark:text-[#b6a88f]/60",
                    )}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </Link>
              </SheetClose>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
