import Script from "next/script";

/**
 * Props used to render the Google Analytics script snippets.
 * @property GA_TRACKING_ID - Tracking ID for Google Analytics (e.g., 'G-XXXXXX').
 * @source
 */
interface GoogleAnalyticsProps {
  GA_TRACKING_ID: string;
}

/**
 * Client-only component that injects Google Analytics scripts.
 * - Loads gtag.js using the provided tracking id.
 * - Initializes a basic page view configuration.
 * @param props - Component props.
 * @returns React fragment that inserts the GA <script> tags.
 * @source
 */
export default function GoogleAnalytics({
  GA_TRACKING_ID,
}: Readonly<GoogleAnalyticsProps>) {
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_TRACKING_ID}`}
        strategy="afterInteractive"
      />
      {/* Minimal runtime initialization for gtag. */}
      <Script id="google-analytics" strategy="afterInteractive">
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
