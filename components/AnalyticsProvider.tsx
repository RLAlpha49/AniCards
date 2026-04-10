// AnalyticsProvider.tsx
//
// Hosts the client-side analytics boundary for the whole app. It keeps Google
// Analytics opt-in, mirrors consent changes across tabs, and leaves Vercel runtime
// telemetry on a separate path because that signal is deployment-controlled rather
// than user-toggled storage.
//
// Mounted in `app/layout.tsx` so route transitions, privacy messaging, and top-level
// scripts all share one consent source of truth.

"use client";

import { Analytics as VercelAnalytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ArrowRight, BarChart3, Shield } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useState } from "react";

import GoogleAnalytics from "@/components/GoogleAnalytics";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/Popover";
import { Switch } from "@/components/ui/Switch";
import { useGoogleAnalytics } from "@/hooks/useGoogleAnalytics";
import {
  ANALYTICS_CONSENT_EVENT,
  ANALYTICS_CONSENT_STORAGE_KEY,
  type AnalyticsConsentState,
  getAnalyticsConsentState,
  safeTrack,
  setAnalyticsConsentState,
  trackNavigation,
} from "@/lib/utils/google-analytics";

interface AnalyticsProviderProps {
  children: React.ReactNode;
  enableRuntimeTelemetry?: boolean;
  trackingId?: string;
  nonce?: string;
}

/**
 * Provides analytics scripts plus the consent UI for Google Analytics.
 *
 * Google Analytics stays off until the visitor opts in. Runtime telemetry can
 * still be enabled separately so deployment-level performance signals do not
 * depend on the consent banner's localStorage state.
 */
export default function AnalyticsProvider({
  children,
  enableRuntimeTelemetry = false,
  trackingId,
  nonce,
}: Readonly<AnalyticsProviderProps>) {
  const [consentState, setConsentState] =
    useState<AnalyticsConsentState>("unset");
  const [hasLoadedPreference, setHasLoadedPreference] = useState(false);
  const consentDescriptionId = useId();
  const manageSwitchId = useId();

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

  const consentGranted = consentState === "granted";
  const analyticsEnabled = Boolean(trackingId) && consentGranted;
  const runtimeTelemetryEnabled = enableRuntimeTelemetry;
  const shouldRenderConsentControls =
    Boolean(trackingId) && hasLoadedPreference;
  const shouldShowBanner =
    shouldRenderConsentControls && consentState === "unset";
  const shouldShowManager =
    shouldRenderConsentControls && consentState !== "unset";

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

      {children}

      {runtimeTelemetryEnabled ? (
        <>
          <VercelAnalytics />
          <SpeedInsights />
        </>
      ) : null}

      {shouldShowManager ? (
        <div className="fixed right-4 bottom-4 z-50">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="
                  border-gold/20 bg-background/90 text-foreground shadow-lg backdrop-blur-sm
                  hover:bg-gold/5
                "
              >
                <BarChart3 className="size-4 text-gold" aria-hidden="true" />
                Analytics {consentGranted ? "On" : "Off"}
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              side="top"
              className="w-80 space-y-4 border-gold/20 bg-background/95 p-4 backdrop-blur-sm"
            >
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  Google Analytics consent
                </p>
                <p className="text-xs text-muted-foreground">
                  Your choice here only controls Google Analytics. Separate
                  Vercel runtime telemetry may still collect privacy-safe
                  performance signals.
                </p>
                <Link
                  href="/privacy"
                  className="
                    inline-flex items-center gap-1 text-xs font-medium text-gold
                    hover:text-gold/80
                  "
                  onClick={() =>
                    safeTrack(() =>
                      trackNavigation("privacy", "analytics_manager"),
                    )
                  }
                >
                  Read the privacy disclosure
                  <ArrowRight className="size-3" aria-hidden="true" />
                </Link>
              </div>

              <div className="space-y-3 rounded-md border border-border/60 bg-muted/20 p-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <Label htmlFor={manageSwitchId}>
                      Allow Google Analytics
                    </Label>
                    <p
                      id={consentDescriptionId}
                      className="text-xs text-muted-foreground"
                    >
                      You can turn this off any time. Turning it off stops
                      future Google Analytics pageview and event tracking.
                    </p>
                  </div>
                  <Switch
                    id={manageSwitchId}
                    checked={consentGranted}
                    onCheckedChange={updateConsent}
                    aria-describedby={consentDescriptionId}
                    className="data-[state=checked]:bg-gold"
                  />
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      ) : null}

      {shouldShowBanner ? (
        <>
          <div
            aria-hidden="true"
            className="pointer-events-none h-48 sm:h-36"
          />
          <div className="
            fixed inset-x-0 bottom-0 z-50 border-t border-gold/20 bg-background/95 p-4 shadow-2xl
            backdrop-blur-sm
          ">
            <div className="
              container mx-auto flex max-w-5xl flex-col gap-4
              sm:flex-row sm:items-end sm:justify-between
            ">
              <div className="flex items-start gap-3">
                <span className="
                  flex size-10 shrink-0 items-center justify-center rounded-full bg-gold/10
                  text-gold
                ">
                  <Shield className="size-5" aria-hidden="true" />
                </span>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">
                    Allow Google Analytics?
                  </p>
                  <p
                    id={consentDescriptionId}
                    className="max-w-3xl text-sm text-muted-foreground"
                  >
                    Google Analytics is off by default. If you opt in, AniCards
                    sends consented pageview and event data using redacted route
                    patterns and bounded labels. Separate Vercel runtime
                    telemetry may still run, and you can change your Google
                    Analytics choice later from the analytics control.
                  </p>
                  <Link
                    href="/privacy"
                    className="
                      inline-flex items-center gap-1 text-xs font-medium text-gold
                      hover:text-gold/80
                    "
                    onClick={() =>
                      safeTrack(() =>
                        trackNavigation("privacy", "analytics_banner"),
                      )
                    }
                  >
                    Learn more about privacy
                    <ArrowRight className="size-3" aria-hidden="true" />
                  </Link>
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => updateConsent(false)}
                >
                  Keep it off
                </Button>
                <Button
                  type="button"
                  className="bg-gold text-white hover:bg-gold/90"
                  onClick={() => updateConsent(true)}
                >
                  Allow Google Analytics
                </Button>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
