"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import DarkModeToggle from "@/components/DarkModeToggle";
import { cn } from "@/lib/utils";
import { safeTrack, trackNavigation } from "@/lib/utils/google-analytics";

const NAV_ITEMS = [
  { label: "Home", href: "/" },
  { label: "Search", href: "/search" },
  { label: "Examples", href: "/examples" },
  { label: "Projects", href: "/projects" },
  { label: "Contact", href: "/contact" },
] as const;

function GoldDiamond({ size = 5 }: Readonly<{ size?: number }>) {
  return (
    <span
      aria-hidden
      className="inline-block shrink-0 rotate-45 bg-gold"
      style={{ width: size, height: size }}
    />
  );
}

export default function HeaderClient() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  return (
    <>
      <div className="w-full px-6 py-4">
        <div
          className={cn(
            "grid grid-cols-[1fr_auto] items-center gap-4",
            "md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]",
          )}
        >
          <Link
            href="/"
            className="group flex items-center gap-3 md:justify-self-start"
          >
            <div className="hidden gap-1 sm:flex">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="bg-gold transition-opacity group-hover:opacity-100"
                  style={{
                    width: 3,
                    height: 14 + i * 5,
                    opacity: 1 - i * 0.25,
                  }}
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
                  className="bg-gold transition-opacity group-hover:opacity-100"
                  style={{
                    width: 3,
                    height: 14 + i * 5,
                    opacity: 1 - i * 0.25,
                  }}
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
                        relative font-body-serif text-xs tracking-[0.15em] text-gold uppercase
                        transition-colors
                      `,
                      !isActive &&
                        "nav-link-underline text-foreground/60 hover:text-gold",
                    )}
                  >
                    {item.label}
                    {isActive && (
                      <motion.div
                        layoutId="nav-underline"
                        className="absolute inset-x-0 -bottom-1 h-0.5 rounded-full bg-gold"
                        transition={{
                          type: "spring",
                          stiffness: 400,
                          damping: 30,
                        }}
                      />
                    )}
                  </Link>
                </span>
              );
            })}
          </nav>

          <div className="flex items-center justify-end gap-3 md:justify-self-end">
            <button
              type="button"
              className="
                flex size-11 shrink-0 items-center justify-center rounded-full border border-gold/20
                bg-background/70 text-foreground/60 transition-colors
                hover:border-gold/35 hover:text-gold
                focus-visible:ring-2 focus-visible:ring-gold/50 focus-visible:outline-none
                md:hidden
              "
              onClick={() => setMobileMenuOpen((current) => !current)}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-navigation"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            >
              <AnimatePresence mode="wait" initial={false}>
                {mobileMenuOpen ? (
                  <motion.span
                    key="close"
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: 90, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <X className="size-5" />
                  </motion.span>
                ) : (
                  <motion.span
                    key="menu"
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: -90, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <Menu className="size-5" />
                  </motion.span>
                )}
              </AnimatePresence>
            </button>

            <DarkModeToggle />
          </div>
        </div>
      </div>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.nav
            id="mobile-navigation"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-gold/20 md:hidden"
            aria-label="Mobile navigation"
          >
            <div className="space-y-1 px-6 py-4">
              {NAV_ITEMS.map((item) => {
                const isActive = pathname === item.href;

                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={() => {
                      setMobileMenuOpen(false);
                      safeTrack(() =>
                        trackNavigation(item.label.toLowerCase(), "header"),
                      );
                    }}
                    className={cn(
                      `
                        block rounded-sm px-2 py-3 font-body-serif text-sm tracking-[0.15em]
                        text-gold uppercase transition-colors
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
          </motion.nav>
        )}
      </AnimatePresence>
    </>
  );
}
