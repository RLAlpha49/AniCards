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

type MastheadNavProps = Readonly<{
  /** Marks the active link in the home page paper palette. */
  home: boolean;
}>;

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
export function MastheadNav({ home }: MastheadNavProps) {
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
              home
                ? active
                  ? "text-[#b83a24] dark:text-[#d4573c]"
                  : "text-[#4d443a] hover:text-[#191512] dark:text-[#b6a88f] dark:hover:text-[#ece1c9]"
                : active
                  ? item.textColor
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white",
            )}
          >
            {item.title}
            <span
              aria-hidden="true"
              className={cn(
                "absolute inset-x-2.5 -bottom-0.5 h-[2px] transition-opacity",
                home
                  ? "bg-[#b83a24] dark:bg-[#d4573c]"
                  : "bg-gradient-to-r from-blue-500 to-purple-500",
                active ? "opacity-100" : "opacity-0",
              )}
            />
          </Link>
        );
      })}
    </nav>
  );
}

type MastheadMenuProps = Readonly<{
  /** Marks the active link in the home page paper palette. */
  home: boolean;
}>;

/**
 * Compact navigation trigger that opens the full menu in a sheet.
 *
 * Shown below the `lg` breakpoint, where the masthead links no longer fit.
 *
 * @param props.home - Whether the paper palette is active.
 * @source
 */
export function MastheadMenu({ home }: MastheadMenuProps) {
  const pathname = usePathname();

  return (
    <Sheet>
      <SheetTrigger
        aria-label="Open navigation menu"
        className={cn(
          "inline-grid h-9 w-9 place-items-center border transition-colors lg:hidden",
          home
            ? "rounded-none border-[#191512]/45 text-[#191512] hover:bg-[#191512] hover:text-[#f3e9d5] dark:border-[#ece1c9]/45 dark:text-[#ece1c9] dark:hover:bg-[#ece1c9] dark:hover:text-[#16120f]"
            : "rounded-xl border-slate-200/50 bg-white/50 text-slate-600 hover:bg-white hover:text-slate-900 dark:border-slate-700/50 dark:bg-slate-800/50 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white",
        )}
      >
        <Menu className="h-5 w-5" />
      </SheetTrigger>

      <SheetContent
        side="right"
        className={cn(
          "w-[min(20rem,85vw)] border-l p-0",
          home
            ? "border-[#191512]/25 bg-[#f3e9d5] dark:border-[#ece1c9]/25 dark:bg-[#16120f]"
            : "border-slate-200/50 bg-white dark:border-slate-700/50 dark:bg-slate-950",
        )}
      >
        <SheetTitle
          className={cn(
            "border-b px-5 py-4 text-xs font-semibold tracking-[0.24em] uppercase",
            home
              ? "border-[#191512]/20 font-[family-name:var(--font-display)] text-[#4d443a] dark:border-[#ece1c9]/20 dark:text-[#b6a88f]"
              : "border-slate-200/50 text-slate-500 dark:border-slate-700/50 dark:text-slate-400",
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
                    home
                      ? cn(
                          "border-b border-[#191512]/10 dark:border-[#ece1c9]/10",
                          active
                            ? "text-[#b83a24] dark:text-[#d4573c]"
                            : "text-[#4d443a] hover:text-[#191512] dark:text-[#b6a88f] dark:hover:text-[#ece1c9]",
                        )
                      : cn(
                          active
                            ? `${item.bgLight} ${item.textColor}`
                            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white",
                        ),
                  )}
                >
                  <item.icon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      home && "text-[#b83a24] dark:text-[#d4573c]",
                    )}
                  />
                  <span className="flex-1">{item.title}</span>
                  <span
                    aria-hidden="true"
                    className={cn(
                      "text-[0.62rem] tracking-[0.2em]",
                      home
                        ? "text-[#4d443a]/60 dark:text-[#b6a88f]/60"
                        : "text-slate-400 dark:text-slate-500",
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
