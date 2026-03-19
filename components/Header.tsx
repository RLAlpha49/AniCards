"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import DarkModeToggle from "@/components/DarkModeToggle";
import { safeTrack, trackNavigation } from "@/lib/utils/google-analytics";

const NAV_ITEMS = [
  { label: "Home", href: "/" },
  { label: "Search", href: "/search" },
  { label: "Examples", href: "/examples" },
  { label: "Projects", href: "/projects" },
  { label: "Contact", href: "/contact" },
];

function GoldDiamond({ size = 5 }: Readonly<{ size?: number }>) {
  return (
    <span
      aria-hidden
      className="bg-gold inline-block shrink-0 rotate-45"
      style={{ width: size, height: size }}
    />
  );
}

export default function Header() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  if (!mounted) return null;

  return (
    <motion.header
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="border-gold/30 sticky top-0 z-50 border-b bg-white/90 backdrop-blur-xl dark:bg-[#0C0A10]"
    >
      <div className="via-gold absolute inset-x-0 top-0 h-0.5 bg-linear-to-r from-transparent to-transparent" />

      <div className="mx-auto max-w-6xl px-6 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="group flex items-center gap-3">
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
            <span className="font-display text-gold text-lg tracking-[0.35em]">
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
            className="hidden items-center gap-4 md:flex"
            aria-label="Main navigation"
          >
            {NAV_ITEMS.map((item, i) => (
              <span key={item.label} className="flex items-center gap-4">
                {i > 0 && <GoldDiamond />}
                <Link
                  href={item.href}
                  onClick={() =>
                    safeTrack(() =>
                      trackNavigation(item.label.toLowerCase(), "header"),
                    )
                  }
                  className={`nav-link-underline font-body-serif text-xs tracking-[0.15em] uppercase transition-colors ${
                    pathname === item.href
                      ? "text-gold"
                      : "text-foreground/60 hover:text-gold"
                  }`}
                >
                  {item.label}
                </Link>
              </span>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <DarkModeToggle />
            <button
              className="text-foreground/60 hover:text-gold transition-colors md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.nav
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-gold/20 overflow-hidden border-t md:hidden"
            aria-label="Mobile navigation"
          >
            <div className="space-y-1 px-6 py-4">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => {
                    setMobileMenuOpen(false);
                    safeTrack(() =>
                      trackNavigation(item.label.toLowerCase(), "header"),
                    );
                  }}
                  className={`font-body-serif block py-2 text-sm tracking-[0.15em] uppercase transition-colors ${
                    pathname === item.href
                      ? "text-gold"
                      : "text-foreground/60 hover:text-gold"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
