"use client";

import { useEffect } from "react";

const SERVICE_WORKER_PATH = "/sw.js";

export default function PwaRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !globalThis.isSecureContext) {
      return;
    }

    void navigator.serviceWorker
      .register(SERVICE_WORKER_PATH, {
        scope: "/",
        updateViaCache: "none",
      })
      .catch(() => {
        // Service worker support is progressive enhancement; registration failures
        // should not block the core shell.
      });
  }, []);

  return null;
}
