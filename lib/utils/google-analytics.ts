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
    try {
      gtag("config", gaId, {
        page_path: url,
      });
    } catch {
      console.error("Google Analytics pageview failed");
    }
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
    try {
      gtag("event", action, {
        event_category: category,
        event_label: label,
        value: value,
      });
    } catch {
      console.error("Google Analytics event failed");
    }
  }
};

/**
 * Thin helper used across the app to safely invoke analytics code without
 * allowing exceptions thrown by analytics shims to crash the UI.
 */
export const safeTrack = (fn: () => void) => {
  try {
    fn();
  } catch {
    console.error("Safe analytics tracking call failed");
  }
};

/** Track a settings change event with GA. @source */
export const trackSettingsChanged = (settingType: string) => {
  event({
    action: "settings_changed",
    category: "engagement",
    label: settingType,
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

/** Track when a color preset is selected in the UI. @source */
export const trackColorPresetSelection = (presetName: string) => {
  event({
    action: "color_preset_selected",
    category: "customization",
    label: presetName,
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

/** Track an error event capturing type and optional message. @source */
export const trackError = (errorType: string, errorMessage?: string) => {
  event({
    action: "error_occurred",
    category: "error",
    label: errorMessage ? `${errorType}_${errorMessage}` : errorType,
  });
};
