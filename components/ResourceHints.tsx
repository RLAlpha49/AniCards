const ANILIST_ORIGIN = "https://anilist.co";
const ANILIST_DNS_PREFETCH = "//anilist.co";

/**
 * Emits privacy-safe, product-relevant resource hints for the shared app shell.
 * Keep consent-sensitive analytics origins out of always-on preconnects.
 */
export default function ResourceHints() {
  return (
    <>
      <link crossOrigin="anonymous" href={ANILIST_ORIGIN} rel="preconnect" />
      <link href={ANILIST_DNS_PREFETCH} rel="dns-prefetch" />
    </>
  );
}
