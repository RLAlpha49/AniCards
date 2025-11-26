import Script from "next/script";

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
  GA_TRACKING_ID: string;
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
  GA_TRACKING_ID,
  nonce,
}: Readonly<GoogleAnalyticsProps>) {
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_TRACKING_ID}`}
        strategy="afterInteractive"
        nonce={nonce}
      />
      <Script id="google-analytics" strategy="afterInteractive" nonce={nonce}>
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_TRACKING_ID}', {
            page_title: document.title,
            page_location: window.location.href,
          });
        `}
      </Script>
    </>
  );
}
