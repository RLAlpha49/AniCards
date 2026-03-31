// PwaRegistration.tsx
//
// Adds progressive PWA behavior on top of the regular site: service-worker registration,
// update prompts when a waiting worker is ready, and a polite install prompt that remembers
// dismissals across visits.
//
// Every branch here fails open. AniCards should still behave like a normal website when
// service workers, storage, or install events are unavailable.

"use client";

import { useEffect, useRef, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";

const SERVICE_WORKER_PATH = "/sw.js";
export const INSTALL_PROMPT_DISMISSAL_STORAGE_KEY =
  "anicards-pwa-install-dismissed-at";
export const INSTALL_PROMPT_DISMISSAL_COOLDOWN_MS = 1000 * 60 * 60 * 24 * 7;

interface BeforeInstallPromptChoice {
  outcome: "accepted" | "dismissed";
  platform: string;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<BeforeInstallPromptChoice>;
}

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type MatchMediaLike = (query: string) => Pick<MediaQueryList, "matches">;

/**
 * Reads the last install-prompt dismissal timestamp from storage.
 *
 * Returns `null` when the preference is missing or unreadable so callers can
 * treat storage failures as "prompt not dismissed" instead of hard-failing the UI.
 */
export function readInstallPromptDismissedAt(
  storage: StorageLike | undefined = globalThis.window?.localStorage,
) {
  try {
    const rawValue = storage?.getItem(INSTALL_PROMPT_DISMISSAL_STORAGE_KEY);

    if (!rawValue) {
      return null;
    }

    const parsedValue = Number.parseInt(rawValue, 10);

    return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : null;
  } catch {
    return null;
  }
}

/**
 * Persists the install-prompt dismissal time so the banner stays quiet during the cooldown.
 */
export function writeInstallPromptDismissedAt(
  dismissedAt: number,
  storage: StorageLike | undefined = globalThis.window?.localStorage,
) {
  try {
    storage?.setItem(INSTALL_PROMPT_DISMISSAL_STORAGE_KEY, String(dismissedAt));
  } catch {
    // Ignore storage write failures; install prompts are progressive enhancement.
  }
}

/**
 * Clears any remembered dismissal once the app is installed or the cooldown should reset.
 */
export function clearInstallPromptDismissal(
  storage: StorageLike | undefined = globalThis.window?.localStorage,
) {
  try {
    storage?.removeItem(INSTALL_PROMPT_DISMISSAL_STORAGE_KEY);
  } catch {
    // Ignore storage write failures; install prompts are progressive enhancement.
  }
}

/**
 * Returns whether the install prompt is still inside the dismissal cooldown window.
 */
export function isInstallPromptDismissed(
  storage: StorageLike | undefined = globalThis.window?.localStorage,
  now = Date.now(),
) {
  const dismissedAt = readInstallPromptDismissedAt(storage);

  if (!dismissedAt) {
    return false;
  }

  return now - dismissedAt < INSTALL_PROMPT_DISMISSAL_COOLDOWN_MS;
}

/**
 * Detects whether AniCards is already running as an installed app.
 *
 * Both `display-mode` and the legacy iOS `navigator.standalone` flag are checked
 * because install detection is not standardized across browsers yet.
 */
export function isStandaloneDisplayMode(
  matchMedia: MatchMediaLike | undefined = globalThis.window?.matchMedia?.bind(
    globalThis.window,
  ),
  browserNavigator:
    | (Navigator & {
        standalone?: boolean;
      })
    | undefined = globalThis.navigator,
) {
  try {
    if (matchMedia?.("(display-mode: standalone)").matches) {
      return true;
    }
  } catch {
    // Ignore matchMedia failures and fall back to navigator detection.
  }

  return Boolean(browserNavigator?.standalone);
}

/**
 * Registers the service worker and renders update or install prompts when the browser supports them.
 */
export default function PwaRegistration() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(
    null,
  );
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);
  const [isApplyingUpdate, setIsApplyingUpdate] = useState(false);
  const [deferredInstallPrompt, setDeferredInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const shouldReloadOnControllerChangeRef = useRef(false);
  const hasReloadedForControllerChangeRef = useRef(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !globalThis.isSecureContext) {
      return;
    }

    let isDisposed = false;
    let registration: ServiceWorkerRegistration | null = null;
    let observedInstallingWorker: ServiceWorker | null = null;

    const showWaitingWorkerPrompt = (worker: ServiceWorker | null) => {
      if (!worker || isDisposed) {
        return;
      }

      setWaitingWorker(worker);
      setIsApplyingUpdate(false);
      setShowUpdatePrompt(true);
    };

    const observeInstallingWorker = (worker: ServiceWorker) => {
      if (observedInstallingWorker === worker) {
        return;
      }

      observedInstallingWorker = worker;
      worker.addEventListener("statechange", () => {
        if (
          worker.state === "installed" &&
          navigator.serviceWorker.controller !== null
        ) {
          showWaitingWorkerPrompt(registration?.waiting ?? worker);
        }
      });
    };

    const handleUpdateFound = () => {
      const installingWorker = registration?.installing;

      if (installingWorker) {
        observeInstallingWorker(installingWorker);
      }
    };

    const handleControllerChange = () => {
      if (
        !shouldReloadOnControllerChangeRef.current ||
        hasReloadedForControllerChangeRef.current
      ) {
        return;
      }

      hasReloadedForControllerChangeRef.current = true;
      globalThis.location.reload();
    };

    navigator.serviceWorker.addEventListener(
      "controllerchange",
      handleControllerChange,
    );

    void navigator.serviceWorker
      .register(SERVICE_WORKER_PATH, {
        scope: "/",
        updateViaCache: "none",
      })
      .then(async (nextRegistration) => {
        if (isDisposed) {
          return;
        }

        registration = nextRegistration;

        if (
          nextRegistration.waiting &&
          navigator.serviceWorker.controller !== null
        ) {
          showWaitingWorkerPrompt(nextRegistration.waiting);
        }

        if (nextRegistration.installing) {
          observeInstallingWorker(nextRegistration.installing);
        }

        nextRegistration.addEventListener("updatefound", handleUpdateFound);

        await nextRegistration.update().catch(() => {
          // Ignore update polling failures; the browser will continue checking.
        });
      })
      .catch(() => {
        // Service worker support is progressive enhancement; registration failures
        // should not block the core shell.
      });

    return () => {
      isDisposed = true;
      registration?.removeEventListener("updatefound", handleUpdateFound);
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        handleControllerChange,
      );
    };
  }, []);

  useEffect(() => {
    if (!globalThis.isSecureContext || isStandaloneDisplayMode()) {
      return;
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      const nextInstallPromptEvent = event as BeforeInstallPromptEvent;

      nextInstallPromptEvent.preventDefault();

      if (isInstallPromptDismissed() || isStandaloneDisplayMode()) {
        return;
      }

      setDeferredInstallPrompt(nextInstallPromptEvent);
      setShowInstallPrompt(true);
    };

    const handleAppInstalled = () => {
      clearInstallPromptDismissal();
      setDeferredInstallPrompt(null);
      setShowInstallPrompt(false);
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== INSTALL_PROMPT_DISMISSAL_STORAGE_KEY) {
        return;
      }

      if (isInstallPromptDismissed()) {
        setDeferredInstallPrompt(null);
        setShowInstallPrompt(false);
      }
    };

    globalThis.addEventListener(
      "beforeinstallprompt",
      handleBeforeInstallPrompt as EventListener,
    );
    globalThis.addEventListener("appinstalled", handleAppInstalled);
    globalThis.addEventListener("storage", handleStorage);

    return () => {
      globalThis.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt as EventListener,
      );
      globalThis.removeEventListener("appinstalled", handleAppInstalled);
      globalThis.removeEventListener("storage", handleStorage);
    };
  }, []);

  const handleApplyUpdate = () => {
    if (!waitingWorker) {
      return;
    }

    shouldReloadOnControllerChangeRef.current = true;
    setIsApplyingUpdate(true);
    waitingWorker.postMessage({
      type: "SKIP_WAITING",
    });
  };

  const handleDismissUpdate = () => {
    setShowUpdatePrompt(false);
  };

  const handleInstallApp = async () => {
    if (!deferredInstallPrompt) {
      return;
    }

    setShowInstallPrompt(false);

    try {
      await deferredInstallPrompt.prompt();

      const installChoice = await deferredInstallPrompt.userChoice;

      if (installChoice.outcome === "dismissed") {
        writeInstallPromptDismissedAt(Date.now());
      } else {
        clearInstallPromptDismissal();
      }
    } catch {
      setShowInstallPrompt(true);
      return;
    }

    setDeferredInstallPrompt(null);
  };

  const handleDismissInstall = () => {
    writeInstallPromptDismissedAt(Date.now());
    setDeferredInstallPrompt(null);
    setShowInstallPrompt(false);
  };

  if (showUpdatePrompt && waitingWorker) {
    return (
      <div className="
        pointer-events-none fixed inset-x-4 bottom-4 z-50 flex justify-end
        md:left-auto
      ">
        <Alert className="
          pointer-events-auto w-full max-w-md rounded-2xl border-border/70 bg-background/95
          shadow-2xl backdrop-blur-sm
          supports-backdrop-filter:bg-background/90
        ">
          <div className="space-y-3">
            <div className="space-y-1">
              <AlertTitle>A fresh AniCards update is ready</AlertTitle>
              <AlertDescription>
                {isApplyingUpdate
                  ? "Applying the updated app shell now. The page will refresh once it takes control."
                  : "Install the updated app shell when you&rsquo;re ready. We&rsquo;ll reload once the new service worker is active."}
              </AlertDescription>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={handleApplyUpdate} disabled={isApplyingUpdate}>
                {isApplyingUpdate ? "Updating…" : "Update now"}
              </Button>
              <Button
                variant="outline"
                onClick={handleDismissUpdate}
                disabled={isApplyingUpdate}
              >
                Later
              </Button>
            </div>
          </div>
        </Alert>
      </div>
    );
  }

  if (showInstallPrompt && deferredInstallPrompt) {
    return (
      <div className="
        pointer-events-none fixed inset-x-4 bottom-4 z-40 flex justify-end
        md:left-auto
      ">
        <Alert className="
          pointer-events-auto w-full max-w-md rounded-2xl border-border/70 bg-background/95
          shadow-2xl backdrop-blur-sm
          supports-backdrop-filter:bg-background/90
        ">
          <div className="space-y-3">
            <div className="space-y-1">
              <AlertTitle>Install AniCards for faster returns</AlertTitle>
              <AlertDescription>
                Add AniCards to your device for an app-like launcher entry,
                quicker access to the cached shell, and smoother repeat visits
                on supported browsers.
              </AlertDescription>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void handleInstallApp()}>
                Install app
              </Button>
              <Button variant="outline" onClick={handleDismissInstall}>
                Not now
              </Button>
            </div>
          </div>
        </Alert>
      </div>
    );
  }

  return null;
}
