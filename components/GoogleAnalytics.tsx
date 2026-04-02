"use client";

import Script from "next/script";
import { useEffect } from "react";

import {
  buildAnalyticsConsentMode,
  reportAnalyticsInstrumentationFailure,
  updateAnalyticsConsentMode,
} from "@/lib/utils/google-analytics";

/**
 * Props used to render the Google Analytics script snippets.
 * @property GA_TRACKING_ID - Tracking ID for Google Analytics (e.g., 'G-XXXXXX').
 * @property nonce - Optional CSP nonce for inline script security. Generated per-request
 *                   in middleware and passed from layout.tsx. Required for Content Security
 *                   Policy compliance when using inline scripts.
 * @see app/middleware.ts for nonce generation
 * @see lib/csp-config.ts for CSP directive configuration
 * @source
 */
interface GoogleAnalyticsProps {
  trackingId: string;
  consentGranted: boolean;
  /** CSP nonce for inline script authorization */
  nonce?: string;
}

/**
 * Client-only component that injects Google Analytics scripts.
 * - Loads gtag.js using the provided tracking id.
 * - Initializes a basic page view configuration.
 * - Supports Content Security Policy via nonce attribute.
 *
 * The nonce is generated per-request in middleware and passed down from the root layout.
 * This ensures inline scripts are authorized by the CSP without using 'unsafe-inline'.
 *
 * @param props - Component props.
 * @returns React fragment that inserts the GA <script> tags.
 * @source
 */
export default function GoogleAnalytics({
  trackingId,
  consentGranted,
  nonce,
}: Readonly<GoogleAnalyticsProps>) {
  const serializedTrackingId = JSON.stringify(trackingId);
  const defaultConsentMode = JSON.stringify(buildAnalyticsConsentMode(false));

  useEffect(() => {
    updateAnalyticsConsentMode(consentGranted);
  }, [consentGranted]);

  const handleLoaderError = (error: Error) => {
    reportAnalyticsInstrumentationFailure({
      userAction: "analytics_script_load",
      error,
      category: "network_error",
      metadata: {
        consentGranted,
        pagePath:
          globalThis.location === undefined
            ? "/"
            : globalThis.location.pathname,
        scriptId: "google_analytics_loader",
        scriptStrategy: "afterInteractive",
      },
    });
  };

  return (
    <>
      <Script
        id="google-analytics-bootstrap"
        strategy="afterInteractive"
        nonce={nonce}
      >
        {`
          window.dataLayer = window.dataLayer || [];
          window.gtag = window.gtag || function gtag(){window.dataLayer.push(arguments);};
          window.gtag('js', new Date());
          window.gtag('consent', 'default', ${defaultConsentMode});
          window.gtag('config', ${serializedTrackingId}, {
            allow_google_signals: false,
            allow_ad_personalization_signals: false,
            send_page_view: false,
          });
        `}
      </Script>
      {consentGranted ? (
        <Script
          id="google-analytics-loader"
          src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(trackingId)}`}
          strategy="afterInteractive"
          nonce={nonce}
          onError={handleLoaderError}
        />
      ) : null}
    </>
  );
}
