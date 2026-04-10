"use client";

import ReactDOM from "react-dom";

const ANILIST_ORIGIN = "https://anilist.co";

/**
 * Emits privacy-safe, product-relevant resource hints for the shared app shell.
 * Keep consent-sensitive analytics origins out of always-on preconnects.
 */
export default function ResourceHints() {
  ReactDOM.preconnect(ANILIST_ORIGIN, { crossOrigin: "" });

  return null;
}
