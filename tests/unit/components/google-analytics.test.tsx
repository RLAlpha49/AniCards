import "@/tests/unit/__setup__";

import { describe, expect, it, mock } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

mock.module("next/script", () => ({
  default: ({
    children,
    id,
    nonce,
    src,
    strategy,
  }: {
    children?: React.ReactNode;
    id?: string;
    nonce?: string;
    src?: string;
    strategy?: string;
  }) => (
    <script data-src={src} data-strategy={strategy} id={id} nonce={nonce}>
      {children}
    </script>
  ),
}));

import GoogleAnalytics from "@/components/GoogleAnalytics";

describe("GoogleAnalytics", () => {
  it("omits the deprecated anonymize_ip flag while preserving privacy-safe GA config", () => {
    const markup = renderToStaticMarkup(
      <GoogleAnalytics
        trackingId="G-TEST123"
        consentGranted={true}
        nonce="nonce-123"
      />,
    );

    expect(markup).not.toContain("anonymize_ip");
    expect(markup).toContain("allow_google_signals: false");
    expect(markup).toContain("allow_ad_personalization_signals: false");
    expect(markup).toContain("send_page_view: false");
    expect(markup).toContain("window.gtag('consent', 'default'");
    expect(markup).toContain('nonce="nonce-123"');
    expect(markup).toContain(
      "https://www.googletagmanager.com/gtag/js?id=G-TEST123",
    );
  });
});
