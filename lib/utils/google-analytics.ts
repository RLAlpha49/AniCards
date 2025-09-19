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

// Log page views
export const pageview = (url: string) => {
  const gaId = process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID;
  if (typeof window !== "undefined" && window.gtag && gaId) {
    window.gtag("config", gaId, {
      page_path: url,
    });
  }
};

// Log specific events
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
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("event", action, {
      event_category: category,
      event_label: label,
      value: value,
    });
  }
};

export const trackCardGeneration = (cardType: string) => {
  event({
    action: "card_generated",
    category: "engagement",
    label: cardType,
  });
};

export const trackCardDownload = (cardType: string) => {
  event({
    action: "card_downloaded",
    category: "conversion",
    label: cardType,
  });
};

export const trackUserSearch = (username: string) => {
  event({
    action: "user_searched",
    category: "engagement",
    label: username,
  });
};

export const trackSettingsChanged = (settingType: string) => {
  event({
    action: "settings_changed",
    category: "engagement",
    label: settingType,
  });
};

export const trackDialogOpen = (dialogType: string) => {
  event({
    action: "dialog_opened",
    category: "engagement",
    label: dialogType,
  });
};

export const trackDialogClose = (dialogType: string) => {
  event({
    action: "dialog_closed",
    category: "engagement",
    label: dialogType,
  });
};

export const trackButtonClick = (buttonName: string, context?: string) => {
  event({
    action: "button_clicked",
    category: "engagement",
    label: context ? `${buttonName}_${context}` : buttonName,
  });
};

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

export const trackSidebarToggle = (action: "expand" | "collapse") => {
  event({
    action: "sidebar_toggled",
    category: "ui_interaction",
    label: action,
  });
};

export const trackColorPresetSelection = (presetName: string) => {
  event({
    action: "color_preset_selected",
    category: "customization",
    label: presetName,
  });
};

export const trackCardPreview = (cardType: string) => {
  event({
    action: "card_previewed",
    category: "engagement",
    label: cardType,
  });
};

export const trackFormSubmission = (formType: string, success: boolean) => {
  event({
    action: success ? "form_submitted_success" : "form_submitted_error",
    category: "conversion",
    label: formType,
  });
};

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

export const trackCopyAction = (copyType: string) => {
  event({
    action: "copy_action",
    category: "engagement",
    label: copyType,
  });
};

export const trackError = (errorType: string, errorMessage?: string) => {
  event({
    action: "error_occurred",
    category: "error",
    label: errorMessage ? `${errorType}_${errorMessage}` : errorType,
  });
};
