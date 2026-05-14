"use client";

import { ArrowRight, BarChart3, Shield } from "lucide-react";
import Link from "next/link";
import { useId } from "react";

import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/Popover";
import { Switch } from "@/components/ui/Switch";
import {
  type AnalyticsConsentState,
  safeTrack,
  trackNavigation,
} from "@/lib/utils/google-analytics";

interface AnalyticsConsentControlsProps {
  consentGranted: boolean;
  consentState: AnalyticsConsentState;
  onConsentChange: (nextGranted: boolean) => void;
}

/**
 * User-facing consent controls for Google Analytics.
 *
 * Loaded lazily so routes that only need the passive analytics bootstrap do not
 * also hydrate the banner, popover, and icon-heavy management UI.
 */
export default function AnalyticsConsentControls({
  consentGranted,
  consentState,
  onConsentChange,
}: Readonly<AnalyticsConsentControlsProps>) {
  const consentDescriptionId = useId();
  const manageSwitchId = useId();
  const shouldShowBanner = consentState === "unset";
  const shouldShowManager = consentState !== "unset";

  if (!shouldShowBanner && !shouldShowManager) {
    return null;
  }

  return (
    <>
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
                    onCheckedChange={onConsentChange}
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
                  onClick={() => onConsentChange(false)}
                >
                  Keep it off
                </Button>
                <Button
                  type="button"
                  className="bg-gold text-white hover:bg-gold/90"
                  onClick={() => onConsentChange(true)}
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
