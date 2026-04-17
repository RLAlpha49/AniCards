// HeaderClient.tsx
//
// Handles the interactive half of the site header after the server-rendered shell is visible.
// It picks up any mobile-menu state opened before hydration, then takes over focus trapping,
// escape handling, and route-change cleanup for the mobile nav.
//
// The `data-*` flags on `<html>` let this component coordinate with the early accessibility
// script in `app/layout.tsx` without duplicating the header state in another bootstrap store.

"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import DarkModeToggle from "@/components/DarkModeToggle";
import { cn } from "@/lib/utils";
import { safeTrack, trackNavigation } from "@/lib/utils/google-analytics";

const NAV_ITEMS = [
  { label: "Home", href: "/" },
  { label: "Search", href: "/search" },
  { label: "Examples", href: "/examples" },
  { label: "Projects", href: "/projects" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
] as const;

const MOBILE_MENU_FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");

const MOBILE_MENU_OPEN_DATASET_KEY = "mobileMenuOpen";
const MOBILE_MENU_HYDRATED_DATASET_KEY = "mobileMenuHydrated";

function isMobileMenuPreopened(): boolean {
  if (typeof document === "undefined") {
    return false;
  }

  return (
    document.documentElement.dataset[MOBILE_MENU_OPEN_DATASET_KEY] === "true"
  );
}

function getFocusableMenuElements(
  container: HTMLElement | null,
): HTMLElement[] {
  if (!container || container.hidden) {
    return [];
  }

  return Array.from(
    container.querySelectorAll<HTMLElement>(MOBILE_MENU_FOCUSABLE_SELECTOR),
  );
}

const BRAND_BAR_CLASSES = [
  "h-3.5 opacity-100",
  "h-[19px] opacity-75",
  "h-6 opacity-50",
] as const;

function GoldDiamond() {
  return (
    <span
      aria-hidden
      className="inline-block size-1.25 shrink-0 rotate-45 bg-gold"
    />
  );
}

export default function HeaderClient() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLElement>(null);
  const mobileMenuToggleRef = useRef<HTMLButtonElement>(null);
  const previousPathnameRef = useRef(pathname);
  const shouldRestoreFocusRef = useRef(false);

  useEffect(() => {
    // Preserve a click that opened the menu before hydration so the UI does not
    // appear to ignore the first interaction on slow boots.
    setMobileMenuOpen(isMobileMenuPreopened());
    document.documentElement.dataset[MOBILE_MENU_HYDRATED_DATASET_KEY] = "true";

    return () => {
      delete document.documentElement.dataset[MOBILE_MENU_HYDRATED_DATASET_KEY];
    };
  }, []);

  useEffect(() => {
    // Mirror state back to `<html>` so the pre-hydration shell and hydrated menu
    // agree about visibility and ARIA state.
    document.documentElement.dataset[MOBILE_MENU_OPEN_DATASET_KEY] =
      mobileMenuOpen ? "true" : "false";
  }, [mobileMenuOpen]);

  const closeMobileMenu = useCallback((restoreFocus: boolean) => {
    shouldRestoreFocusRef.current = restoreFocus;
    setMobileMenuOpen(false);
  }, []);

  const openMobileMenu = useCallback(() => {
    shouldRestoreFocusRef.current = false;
    setMobileMenuOpen(true);
  }, []);

  const toggleMobileMenu = useCallback(() => {
    if (mobileMenuOpen) {
      closeMobileMenu(true);
      return;
    }

    openMobileMenu();
  }, [closeMobileMenu, mobileMenuOpen, openMobileMenu]);

  useEffect(() => {
    if (previousPathnameRef.current === pathname) {
      return;
    }

    previousPathnameRef.current = pathname;

    if (!mobileMenuOpen) {
      return;
    }

    shouldRestoreFocusRef.current = false;
    setMobileMenuOpen(false);
  }, [mobileMenuOpen, pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) {
      if (shouldRestoreFocusRef.current) {
        shouldRestoreFocusRef.current = false;
        requestAnimationFrame(() => {
          mobileMenuToggleRef.current?.focus();
        });
      }

      return;
    }

    const focusMenu = () => {
      const [firstFocusable] = getFocusableMenuElements(mobileMenuRef.current);
      (firstFocusable ?? mobileMenuRef.current)?.focus();
    };

    const focusFrame = requestAnimationFrame(focusMenu);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMobileMenu(true);
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusableElements = getFocusableMenuElements(mobileMenuRef.current);
      if (focusableElements.length === 0) {
        event.preventDefault();
        mobileMenuRef.current?.focus();
        return;
      }

      const firstFocusable = focusableElements[0];
      const lastFocusable = focusableElements.at(-1);
      const activeElement = globalThis.document
        .activeElement as HTMLElement | null;
      const isFocusInsideMenu = Boolean(
        activeElement && mobileMenuRef.current?.contains(activeElement),
      );

      if (event.shiftKey) {
        if (!isFocusInsideMenu || activeElement === firstFocusable) {
          event.preventDefault();
          (lastFocusable ?? firstFocusable).focus();
        }
        return;
      }

      if (!isFocusInsideMenu || activeElement === lastFocusable) {
        event.preventDefault();
        firstFocusable.focus();
      }
    };

    globalThis.document.addEventListener("keydown", handleKeyDown);

    return () => {
      cancelAnimationFrame(focusFrame);
      globalThis.document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeMobileMenu, mobileMenuOpen]);

  return (
    <>
      <div className="w-full px-6 py-4">
        <div
          className={cn(
            "grid grid-cols-[1fr_auto] items-center gap-4",
            "grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]",
          )}
        >
          <Link
            href="/"
            className="
              group flex items-center gap-3 rounded-sm
              focus-visible:ring-2 focus-visible:ring-gold/50 focus-visible:ring-offset-2
              focus-visible:ring-offset-background focus-visible:outline-none
              md:justify-self-start
            "
          >
            <div className="hidden gap-1 sm:flex">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className={cn(
                    "w-[3px] bg-gold transition-opacity group-hover:opacity-100",
                    BRAND_BAR_CLASSES[i],
                  )}
                />
              ))}
            </div>
            <span className="font-display text-lg tracking-[0.35em] text-gold">
              ANICARDS
            </span>
            <div className="hidden gap-1 sm:flex">
              {[2, 1, 0].map((i) => (
                <div
                  key={i}
                  className={cn(
                    "w-[3px] bg-gold transition-opacity group-hover:opacity-100",
                    BRAND_BAR_CLASSES[i],
                  )}
                />
              ))}
            </div>
          </Link>

          <nav
            className="hidden items-center justify-center gap-4 md:flex md:justify-self-center"
            aria-label="Main navigation"
          >
            {NAV_ITEMS.map((item, index) => {
              const isActive = pathname === item.href;

              return (
                <span key={item.label} className="flex items-center gap-4">
                  {index > 0 && <GoldDiamond />}
                  <Link
                    href={item.href}
                    onClick={() =>
                      safeTrack(() =>
                        trackNavigation(item.label.toLowerCase(), "header"),
                      )
                    }
                    className={cn(
                      `
                        relative rounded-sm font-body-serif text-xs tracking-[0.15em] text-gold
                        uppercase transition-colors
                        focus-visible:text-gold focus-visible:ring-2 focus-visible:ring-gold/50
                        focus-visible:ring-offset-2 focus-visible:ring-offset-background
                        focus-visible:outline-none
                      `,
                      !isActive &&
                        "nav-link-underline text-foreground/60 hover:text-gold",
                    )}
                  >
                    {item.label}
                    {isActive && (
                      <span
                        aria-hidden
                        className="absolute inset-x-0 -bottom-1 h-0.5 rounded-full bg-gold"
                      />
                    )}
                  </Link>
                </span>
              );
            })}
          </nav>

          <div className="flex items-center justify-end gap-3 md:justify-self-end">
            <button
              ref={mobileMenuToggleRef}
              type="button"
              data-mobile-menu-toggle="true"
              className="
                flex size-11 shrink-0 touch-manipulation-safe items-center justify-center
                rounded-full border border-gold/20 bg-background/70 text-foreground/60
                transition-colors
                hover:border-gold/35 hover:text-gold
                focus-visible:ring-2 focus-visible:ring-gold/50 focus-visible:outline-none
                md:hidden
              "
              onClick={toggleMobileMenu}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-navigation"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            >
              <span className="relative size-5" aria-hidden>
                <span
                  className={cn(
                    `
                      absolute inset-0 flex items-center justify-center transition-all duration-150
                      motion-reduce:transition-none
                    `,
                    mobileMenuOpen
                      ? "rotate-90 opacity-0"
                      : "rotate-0 opacity-100",
                  )}
                >
                  <Menu className="size-5" />
                </span>
                <span
                  className={cn(
                    `
                      absolute inset-0 flex items-center justify-center transition-all duration-150
                      motion-reduce:transition-none
                    `,
                    mobileMenuOpen
                      ? "rotate-0 opacity-100"
                      : "-rotate-90 opacity-0",
                  )}
                >
                  <X className="size-5" />
                </span>
              </span>
            </button>

            <DarkModeToggle />
          </div>
        </div>
      </div>

      <nav
        ref={mobileMenuRef}
        id="mobile-navigation"
        data-mobile-navigation="true"
        className="overflow-hidden border-t border-gold/20 md:hidden"
        aria-label="Mobile navigation"
        hidden={!mobileMenuOpen}
        tabIndex={-1}
      >
        <div className="min-h-0 space-y-1 px-6 py-4">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => {
                  closeMobileMenu(false);
                  safeTrack(() =>
                    trackNavigation(item.label.toLowerCase(), "header"),
                  );
                }}
                className={cn(
                  `
                    block rounded-sm px-2 py-3 font-body-serif text-sm tracking-[0.15em] text-gold
                    uppercase transition-colors
                    focus-visible:text-gold focus-visible:ring-2 focus-visible:ring-gold/50
                    focus-visible:ring-offset-2 focus-visible:ring-offset-background
                    focus-visible:outline-none
                  `,
                  !isActive &&
                    "text-foreground/60 uppercase transition-colors hover:text-gold",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      <noscript>
        <style>{`
          [data-mobile-menu-toggle="true"] {
            display: none !important;
          }
        `}</style>
        <nav
          aria-label="Mobile navigation"
          className="border-t border-gold/20 md:hidden"
          data-mobile-navigation-fallback="true"
        >
          <div className="min-h-0 space-y-1 px-6 py-4">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href;

              return (
                <Link
                  key={`noscript-${item.label}`}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    `
                      block rounded-sm px-2 py-3 font-body-serif text-sm tracking-[0.15em] text-gold
                      uppercase transition-colors
                      focus-visible:text-gold focus-visible:ring-2 focus-visible:ring-gold/50
                      focus-visible:ring-offset-2 focus-visible:ring-offset-background
                      focus-visible:outline-none
                    `,
                    !isActive &&
                      "text-foreground/60 uppercase transition-colors hover:text-gold",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </noscript>
    </>
  );
}
