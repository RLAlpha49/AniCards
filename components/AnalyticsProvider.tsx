// AnalyticsProvider.tsx
//
// Hosts the minimal client-side analytics bootstrap for the whole app. It keeps
// Google Analytics opt-in, mirrors consent changes across tabs, and leaves Vercel
// runtime telemetry on a separate path because that signal is deployment-controlled
// rather than user-toggled storage.
//
// Mounted alongside the shared shell in `app/layout.tsx` so analytics does not wrap
// the entire route tree in an extra client boundary.

"use client";

import { Analytics as VercelAnalytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

import GoogleAnalytics from "@/components/GoogleAnalytics";
import { useGoogleAnalytics } from "@/hooks/useGoogleAnalytics";
import {
  ANALYTICS_CONSENT_EVENT,
  ANALYTICS_CONSENT_STORAGE_KEY,
  type AnalyticsConsentState,
  getAnalyticsConsentState,
  setAnalyticsConsentState,
} from "@/lib/utils/google-analytics";

interface AnalyticsProviderProps {
  enableRuntimeTelemetry?: boolean;
  trackingId?: string;
  nonce?: string;
}

const AnalyticsConsentControls = dynamic(
  () => import("@/components/AnalyticsConsentControls"),
  {
    loading: () => null,
  },
);

/**
 * Provides the thin analytics bootstrap mounted from the root layout.
 *
 * Google Analytics stays off until the visitor opts in. Runtime telemetry can
 * still be enabled separately so deployment-level performance signals do not
 * depend on the lazily loaded consent banner's localStorage state.
 */
export default function AnalyticsProvider({
  enableRuntimeTelemetry = false,
  trackingId,
  nonce,
}: Readonly<AnalyticsProviderProps>) {
  const [consentState, setConsentState] =
    useState<AnalyticsConsentState>("unset");
  const [hasLoadedPreference, setHasLoadedPreference] = useState(false);
  const [shouldRenderConsentControls, setShouldRenderConsentControls] =
    useState(false);

  useEffect(() => {
    const syncConsentState = () => {
      setConsentState(getAnalyticsConsentState());
      setHasLoadedPreference(true);
    };

    syncConsentState();

    const handleStorage = (event: StorageEvent) => {
      if (event.key && event.key !== ANALYTICS_CONSENT_STORAGE_KEY) return;
      syncConsentState();
    };
    const handleConsentChanged = () => {
      syncConsentState();
    };

    globalThis.addEventListener("storage", handleStorage);
    globalThis.addEventListener(
      ANALYTICS_CONSENT_EVENT,
      handleConsentChanged as EventListener,
    );

    return () => {
      globalThis.removeEventListener("storage", handleStorage);
      globalThis.removeEventListener(
        ANALYTICS_CONSENT_EVENT,
        handleConsentChanged as EventListener,
      );
    };
  }, []);

  useEffect(() => {
    if (!trackingId || !hasLoadedPreference) {
      return;
    }

    const timeoutId = globalThis.window.setTimeout(() => {
      setShouldRenderConsentControls(true);
    }, 0);

    return () => {
      globalThis.window.clearTimeout(timeoutId);
    };
  }, [hasLoadedPreference, trackingId]);

  const consentGranted = consentState === "granted";
  const analyticsEnabled = Boolean(trackingId) && consentGranted;
  const runtimeTelemetryEnabled = enableRuntimeTelemetry;
  const shouldRenderConsentUi = Boolean(trackingId) && hasLoadedPreference;

  useGoogleAnalytics(analyticsEnabled);

  const updateConsent = (nextGranted: boolean) => {
    const nextState: Exclude<AnalyticsConsentState, "unset"> = nextGranted
      ? "granted"
      : "denied";
    setConsentState(nextState);
    setHasLoadedPreference(true);
    setAnalyticsConsentState(nextState);
  };

  return (
    <>
      {trackingId ? (
        <GoogleAnalytics
          trackingId={trackingId}
          consentGranted={consentGranted}
          nonce={nonce}
        />
      ) : null}

      {runtimeTelemetryEnabled ? (
        <>
          <VercelAnalytics />
          <SpeedInsights />
        </>
      ) : null}

      {shouldRenderConsentUi && shouldRenderConsentControls ? (
        <AnalyticsConsentControls
          consentGranted={consentGranted}
          consentState={consentState}
          onConsentChange={updateConsent}
        />
      ) : null}
    </>
  );
}
