// app/layout.tsx
//
// Composes the shared shell for every route: fonts, structured data,
// consent-aware analytics, and the global layout wrapper.
//
// The early accessibility script runs before React hydrates so skip-link and
// mobile-menu interactions still work during slow boots or while JavaScript is loading.

import "./globals.css";

import type { Metadata, Viewport } from "next";
import {
  Geist,
  Geist_Mono,
  Libre_Baskerville,
  Playfair_Display_SC,
} from "next/font/google";
import { Suspense } from "react";

import AnalyticsProvider from "@/components/AnalyticsProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import GithubCorner from "@/components/GithubCorner";
import { LayoutShell } from "@/components/LayoutShell";
import ResourceHints from "@/components/ResourceHints";
import SkipLink from "@/components/SkipLink";
import { StructuredDataScript } from "@/components/StructuredDataScript";
import { getRequestNonce } from "@/lib/request-nonce";
import { siteMetadata } from "@/lib/seo";
import { generateSiteStructuredData } from "@/lib/structured-data";

import { Providers } from "./providers";

// Inline because the skip link and mobile-menu fallback need to work before any
// client component can attach event handlers.
const EARLY_ACCESSIBILITY_SHELL_SCRIPT = `(function () {
  const root = document.documentElement;
  const focusableSelector = [
    'a[href]',
    'button:not([disabled])',
    "[tabindex]:not([tabindex='-1'])",
  ].join(', ');

  function shellHydrated() {
    return root.dataset.mobileMenuHydrated === 'true';
  }

  function getMainContent() {
    return document.getElementById('main-content');
  }

  function getMenuToggle() {
    return document.querySelector('[data-mobile-menu-toggle="true"]');
  }

  function getMobileNavigation() {
    return document.querySelector('[data-mobile-navigation="true"]');
  }

  function getFocusableMenuElements() {
    const mobileNavigation = getMobileNavigation();

    if (!(mobileNavigation instanceof HTMLElement)) {
      return [];
    }

    return Array.from(mobileNavigation.querySelectorAll(focusableSelector)).filter(
      (element) => element instanceof HTMLElement && !element.hasAttribute('aria-hidden'),
    );
  }

  function focusMainContent() {
    const mainContent = getMainContent();

    if (!(mainContent instanceof HTMLElement)) {
      return;
    }

    mainContent.scrollIntoView({ block: 'start' });
    mainContent.focus();
    history.replaceState(null, '', '#main-content');
  }

  function syncMobileMenu(open, restoreFocus) {
    const menuToggle = getMenuToggle();
    const mobileNavigation = getMobileNavigation();

    root.dataset.mobileMenuOpen = open ? 'true' : 'false';

    if (menuToggle instanceof HTMLElement) {
      menuToggle.setAttribute('aria-expanded', String(open));
      menuToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    }

    if (mobileNavigation instanceof HTMLElement) {
      if (open) {
        mobileNavigation.removeAttribute('hidden');
        mobileNavigation.setAttribute('aria-hidden', 'false');
      } else {
        mobileNavigation.setAttribute('hidden', '');
        mobileNavigation.setAttribute('aria-hidden', 'true');
      }
    }

    if (open) {
      const [firstFocusable] = getFocusableMenuElements();
      (firstFocusable || mobileNavigation)?.focus();
      return;
    }

    if (restoreFocus && menuToggle instanceof HTMLElement) {
      menuToggle.focus();
    }
  }

  document.addEventListener('click', function (event) {
    const target = event.target;

    if (!(target instanceof Element)) {
      return;
    }

    const skipLink = target.closest('[data-skip-link="true"]');

    if (skipLink instanceof HTMLAnchorElement) {
      event.preventDefault();
      focusMainContent();
      return;
    }

    if (shellHydrated()) {
      return;
    }

    const menuToggle = target.closest('[data-mobile-menu-toggle="true"]');

    if (!(menuToggle instanceof HTMLElement)) {
      return;
    }

    event.preventDefault();
    syncMobileMenu(menuToggle.getAttribute('aria-expanded') !== 'true', false);
  }, true);

  document.addEventListener('keydown', function (event) {
    if (!shellHydrated()) {
      const open = root.dataset.mobileMenuOpen === 'true';

      if (!open) {
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        syncMobileMenu(false, true);
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const focusableElements = getFocusableMenuElements();
      const mobileNavigation = getMobileNavigation();

      if (!(mobileNavigation instanceof HTMLElement)) {
        return;
      }

      if (focusableElements.length === 0) {
        event.preventDefault();
        mobileNavigation.focus();
        return;
      }

      const firstFocusable = focusableElements[0];
      const lastFocusable = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;
      const isFocusInsideMenu = activeElement instanceof HTMLElement
        && mobileNavigation.contains(activeElement);

      if (event.shiftKey) {
        if (!isFocusInsideMenu || activeElement === firstFocusable) {
          event.preventDefault();
          (lastFocusable || firstFocusable).focus();
        }
        return;
      }

      if (!isFocusInsideMenu || activeElement === lastFocusable) {
        event.preventDefault();
        firstFocusable.focus();
      }
      return;
    }

    if (event.key === 'Enter' && document.activeElement?.matches('[data-skip-link="true"]')) {
      event.preventDefault();
      focusMainContent();
    }
  }, true);
})();`;

/**
 * Maps the Geist Sans face to the global CSS variable for site typography.
 * @source
 */
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

/**
 * Exposes the Geist Mono face via a CSS variable for monospaced UI elements.
 * @source
 */
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const playfairDisplaySC = Playfair_Display_SC({
  variable: "--font-playfair-display-sc",
  subsets: ["latin"],
  weight: ["400", "700", "900"],
});

const libreBaskerville = Libre_Baskerville({
  variable: "--font-libre-baskerville",
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = siteMetadata;

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light dark",
};

/**
 * Root layout that injects fonts, analytics, and the shared shell.
 *
 * This layout also integrates Content Security Policy (CSP) support by:
 * - Retrieving the nonce from request headers (generated by middleware)
 * - Passing the nonce to GoogleAnalytics for its inline scripts
 *
 * @param children - Page content rendered within the shared layout and providers.
 * @see app/middleware.ts for CSP header generation
 * @see lib/csp-config.ts for CSP directive configuration
 * @see docs/PRIVACY.md for the current analytics consent and telemetry posture
 * @source
 */
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = await getRequestNonce();
  const isVercelDeployment = process.env.VERCEL === "1";

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        id="app-root"
        className={`${geistSans.variable} ${geistMono.variable} ${playfairDisplaySC.variable} ${libreBaskerville.variable}
          antialiased
        `}
      >
        <SkipLink />
        <script
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: EARLY_ACCESSIBILITY_SHELL_SCRIPT,
          }}
        />
        <ResourceHints />
        <GithubCorner />
        <Providers nonce={nonce}>
          <Suspense fallback={<div>Loading...</div>}>
            <StructuredDataScript
              data={generateSiteStructuredData()}
              nonce={nonce}
            />
            <AnalyticsProvider
              enableRuntimeTelemetry={isVercelDeployment}
              trackingId={process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID}
              nonce={nonce}
            >
              <ErrorBoundary>
                <LayoutShell>{children}</LayoutShell>
              </ErrorBoundary>
            </AnalyticsProvider>
          </Suspense>
        </Providers>
      </body>
    </html>
  );
}
