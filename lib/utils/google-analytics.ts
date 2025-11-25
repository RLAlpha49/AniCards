/**
 * Configuration shape used by Google Analytics gtag calls.
 * @source
 */
interface GAConfig {
  page_path?: string;
  page_title?: string;
  page_location?: string;
  event_category?: string;
  event_label?: string;
  value?: number;
  [key: string]: string | number | boolean | undefined;
}

declare global {
  interface Window {
    gtag: (command: string, targetId: string, config?: GAConfig) => void;
  }
}

// A typed alias for the gtag function to avoid repeating the signature.
type GtagFunction = (
  command: string,
  targetId: string,
  config?: GAConfig,
) => void;

/**
 * Safely retrieve the global gtag function from globalThis in a way that
 * works both in browser and server environments.
 */
const getGtag = (): GtagFunction | undefined => {
  if (typeof globalThis === "undefined") return undefined;
  // globalThis in browsers is the Window object; cast safely to the Window type
  const win = globalThis as unknown as Window;
  return win.gtag as GtagFunction | undefined;
};

/**
 * Send a pageview event to Google Analytics using the configured GA property.
 * @param url - The path of the page to report.
 * @source
 */
export const pageview = (url: string): void => {
  const gaId = process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID;
  const gtag = getGtag();
  if (gtag && gaId) {
    gtag("config", gaId, {
      page_path: url,
    });
  }
};

/**
 * Send a custom event to Google Analytics via gtag.
 * @param action - Event action name used in GA.
 * @param category - The category to group the event within.
 * @param label - Optional label for additional context.
 * @param value - Optional numeric value for metrics.
 * @source
 */
export const event = ({
  action,
  category,
  label,
  value,
}: {
  action: string;
  category: string;
  label?: string;
  value?: number;
}) => {
  const gtag = getGtag();
  if (gtag) {
    gtag("event", action, {
      event_category: category,
      event_label: label,
      value: value,
    });
  }
};

/** Log a card generation event with GA using a card type label. @source */
export const trackCardGeneration = (cardType: string) => {
  event({
    action: "card_generated",
    category: "engagement",
    label: cardType,
  });
};

/** Log a card download event with GA using a card type label. @source */
export const trackCardDownload = (cardType: string) => {
  event({
    action: "card_downloaded",
    category: "conversion",
    label: cardType,
  });
};

/** Track when multiple cards are exported in a batch. @source */
export const trackBatchExport = (
  format: "png" | "webp",
  cardCount: number,
  success: boolean,
) => {
  event({
    action: "batch_export",
    category: "conversion",
    label: `${format}_${cardCount}_cards_${success ? "success" : "failure"}`,
    value: cardCount,
  });
};

/** Track a user search by username in GA events. @source */
export const trackUserSearch = (username: string) => {
  event({
    action: "user_searched",
    category: "engagement",
    label: username,
  });
};

/** Track a settings change event with GA. @source */
export const trackSettingsChanged = (settingType: string) => {
  event({
    action: "settings_changed",
    category: "engagement",
    label: settingType,
  });
};

/** Track when a dialog is opened by type for analytics. @source */
export const trackDialogOpen = (dialogType: string) => {
  event({
    action: "dialog_opened",
    category: "engagement",
    label: dialogType,
  });
};

/** Track when a dialog is closed by type for analytics. @source */
export const trackDialogClose = (dialogType: string) => {
  event({
    action: "dialog_closed",
    category: "engagement",
    label: dialogType,
  });
};

/** Track button clicks in the UI with optional context. @source */
export const trackButtonClick = (buttonName: string, context?: string) => {
  event({
    action: "button_clicked",
    category: "engagement",
    label: context ? `${buttonName}_${context}` : buttonName,
  });
};

/** Track a navigation event including the destination and optional source context. @source */
export const trackNavigation = (
  destinationPage: string,
  sourceContext?: string,
) => {
  event({
    action: "navigation",
    category: "engagement",
    label: sourceContext
      ? `${sourceContext}_to_${destinationPage}`
      : destinationPage,
  });
};

/** Track sidebar expand/collapse actions in GA. @source */
export const trackSidebarToggle = (action: "expand" | "collapse") => {
  event({
    action: "sidebar_toggled",
    category: "ui_interaction",
    label: action,
  });
};

/** Track when a color preset is selected in the UI. @source */
export const trackColorPresetSelection = (presetName: string) => {
  event({
    action: "color_preset_selected",
    category: "customization",
    label: presetName,
  });
};

/** Track previewing a card for GA analysis. @source */
export const trackCardPreview = (cardType: string) => {
  event({
    action: "card_previewed",
    category: "engagement",
    label: cardType,
  });
};

/** Track form submission success or failure for product analytics. @source */
export const trackFormSubmission = (formType: string, success: boolean) => {
  event({
    action: success ? "form_submitted_success" : "form_submitted_error",
    category: "conversion",
    label: formType,
  });
};

/** Track clicks on external links with optional context indicating origin. @source */
export const trackExternalLinkClick = (
  linkDestination: string,
  context?: string,
) => {
  event({
    action: "external_link_clicked",
    category: "engagement",
    label: context ? `${context}_${linkDestination}` : linkDestination,
  });
};

/** Track copy actions (e.g., copying a URL) for analytics. @source */
export const trackCopyAction = (copyType: string) => {
  event({
    action: "copy_action",
    category: "engagement",
    label: copyType,
  });
};

/** Track an error event capturing type and optional message. @source */
export const trackError = (errorType: string, errorMessage?: string) => {
  event({
    action: "error_occurred",
    category: "error",
    label: errorMessage ? `${errorType}_${errorMessage}` : errorType,
  });
};
