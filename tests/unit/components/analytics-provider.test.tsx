import "@/tests/unit/__setup__";

import { afterEach, describe, expect, it, mock } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

mock.module("next/navigation", () => ({
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

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

mock.module("@vercel/analytics/next", () => ({
  Analytics: () => <div data-kind="vercel-analytics-stub" />,
}));

mock.module("@vercel/speed-insights/next", () => ({
  SpeedInsights: () => <div data-kind="speed-insights-stub" />,
}));

import AnalyticsProvider from "@/components/AnalyticsProvider";

describe("AnalyticsProvider", () => {
  afterEach(() => {
    mock.restore();
    (globalThis as { window?: unknown }).window = undefined;
  });

  it("renders Vercel runtime telemetry whenever runtime telemetry is enabled", () => {
    const markup = renderToStaticMarkup(
      <AnalyticsProvider enableRuntimeTelemetry={true} trackingId="G-TEST123">
        <div>child content</div>
      </AnalyticsProvider>,
    );

    expect(markup).toContain('data-kind="vercel-analytics-stub"');
    expect(markup).toContain('data-kind="speed-insights-stub"');
    expect(markup).toContain('id="google-analytics-bootstrap"');
    expect(markup).not.toContain(
      "https://www.googletagmanager.com/gtag/js?id=G-TEST123",
    );
  });

  it("omits Vercel runtime telemetry when the runtime telemetry flag is disabled", () => {
    const markup = renderToStaticMarkup(
      <AnalyticsProvider trackingId="G-TEST123">
        <div>child content</div>
      </AnalyticsProvider>,
    );

    expect(markup).not.toContain('data-kind="vercel-analytics-stub"');
    expect(markup).not.toContain('data-kind="speed-insights-stub"');
    expect(markup).toContain('id="google-analytics-bootstrap"');
  });
});
