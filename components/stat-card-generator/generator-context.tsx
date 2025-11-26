"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useStatCardSubmit } from "@/hooks/use-stat-card-submit";
import { useUserPreferences, useCardSettings } from "@/lib/stores";
import { mediaStatsTemplate } from "@/lib/svg-templates/media-stats";
import {
  trackCardGeneration,
  trackUserSearch,
} from "@/lib/utils/google-analytics";
import { colorPresets, statCardTypes } from "./constants";
import type { ColorValue } from "@/lib/types/card";

type ColorPresetKey = keyof typeof colorPresets;
type MediaStatsPreviewData = Parameters<typeof mediaStatsTemplate>[0];

interface ColorPickerConfig {
  id: string;
  label: string;
  value: ColorValue;
  onChange: (value: ColorValue) => void;
  /** When true, disables the gradient mode toggle button */
  disableGradient?: boolean;
}

interface GeneratorContextValue {
  username: string;
  updateUsername: (next: string) => void;
  titleColor: ColorValue;
  backgroundColor: ColorValue;
  textColor: ColorValue;
  circleColor: ColorValue;
  borderColor: string;
  selectedCards: string[];
  selectedCardVariants: Record<string, string>;
  allSelected: boolean;
  selectedPreset: ColorPresetKey;
  previewOpen: boolean;
  previewType: string;
  previewVariation: string;
  showFavoritesByCard: Record<string, boolean>;
  useAnimeStatusColors: boolean;
  useMangaStatusColors: boolean;
  showPiePercentages: boolean;
  hasBorder: boolean;
  loading: boolean;
  error: Error | null;
  clearError: () => void;
  retryAttempt: number;
  retryLimit: number;
  retryOperation?: string | null;
  isRetrying: boolean;
  overlayText: string;
  retryStatusText: string | null;
  friendlyErrorMessage: string | null;
  previewSVG: string;
  previewData: MediaStatsPreviewData;
  colorPickers: ColorPickerConfig[];
  borderColorPicker: ColorPickerConfig;
  currentStep: number;
  goToStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  handleToggleCard: (cardId: string) => void;
  handleVariantChange: (cardType: string, variant: string) => void;
  handleSelectAll: () => void;
  handlePreview: (cardType: string, variant?: string) => void;
  handleToggleShowFavorites: (cardId: string) => void;
  handleToggleAnimeStatusColors: () => void;
  handleToggleMangaStatusColors: () => void;
  handleToggleShowPiePercentages: () => void;
  handleToggleBorder: () => void;
  handleBorderColorChange: (value: ColorValue) => void;
  handlePresetChange: (preset: ColorPresetKey) => void;
  handleSubmit: () => Promise<void>;
  openPreview: (cardType: string, variant?: string) => void;
  closePreview: () => void;
}

interface GeneratorProviderProps {
  readonly children: ReactNode;
  readonly router: ReturnType<typeof import("next/navigation").useRouter>;
}

const GeneratorContext = createContext<GeneratorContextValue | undefined>(
  undefined,
);

const STEP_COUNT = 4;

/**
 * Returns the color palette for a given preset name; falls back to default
 * preset colors if the requested preset is missing.
 * @param presetName - Name of the preset to look up.
 * @returns Color definitions for the preset.
 * @source
 */
function getPresetColors(presetName: string) {
  const preset = colorPresets[presetName];
  return preset?.colors || colorPresets.default.colors;
}

function buildFriendlyErrorMessage(error: Error | null): string | null {
  if (!error) return null;
  const msg = error.message || "An error occurred.";
  if (msg.startsWith("Please ")) return msg;

  if (
    msg.includes("AniList user fetch failed") ||
    msg.includes("AniList user ID fetch failed") ||
    (msg.includes("AniList") &&
      msg.includes("user") &&
      msg.includes("fetch failed"))
  ) {
    console.error("Detailed AniList user fetch error:", msg);
    if (msg.toLowerCase().includes("no user found")) {
      return "We couldn't find that AniList user. Please double check the username and try again.";
    }
    return "We couldn't find that AniList user. Please double check the username and try again.";
  }

  if (
    msg.includes("AniList stats fetch failed") ||
    msg.includes("AniList user stats fetch failed") ||
    (msg.includes("AniList") &&
      msg.includes("stats") &&
      msg.includes("fetch failed"))
  ) {
    console.error("Detailed AniList stats fetch error:", msg);
    return "We couldn't load user stats from AniList. Try again in a few moments.";
  }

  if (
    msg.toLowerCase().includes("timed out") ||
    msg.toLowerCase().includes("total timeout exceeded") ||
    msg.toLowerCase().includes("request timed out")
  ) {
    console.error("AniList timeout error:", msg);
    return "Reading AniList data took too long. Try again or check your connection.";
  }

  if (msg.includes("Store users failed")) {
    console.error("Detailed store users error:", msg);
    return "There was an issue saving your user data. Please try again later.";
  }

  if (msg.includes("Store cards failed")) {
    console.error("Detailed store cards error:", msg);
    return "There was an issue saving your cards. Please try again later.";
  }

  if (msg.toLowerCase().includes("timed out")) {
    console.error("Request timeout:", msg);
    return "One or more network requests timed out. Please try again.";
  }

  console.error("Unhandled error in stat-card submission:", msg);
  return "An unexpected error occurred. Please try again later.";
}

export function GeneratorProvider({
  children,
  router,
}: GeneratorProviderProps) {
  const { defaultUsername, setDefaultUsername } = useUserPreferences();

  const {
    savedColorConfig,
    defaultCardTypes,
    defaultVariants,
    defaultShowFavoritesByCard,
    defaultBorderEnabled,
    defaultBorderColor,
    useAnimeStatusColors,
    useMangaStatusColors,
    showPiePercentages,
    setSavedColorConfig,
    setDefaultCardTypes,
    setDefaultVariant,
    toggleShowFavorites,
    setDefaultBorderEnabled,
    setDefaultBorderColor,
    setUseAnimeStatusColors,
    setUseMangaStatusColors,
    setShowPiePercentages,
  } = useCardSettings();

  const effectiveColors = useMemo(
    () => savedColorConfig?.colors ?? colorPresets.default.colors,
    [savedColorConfig],
  );

  const [titleColor, backgroundColor, textColor, circleColor] = effectiveColors;

  const effectivePreset = useMemo<ColorPresetKey>(() => {
    if (!savedColorConfig) {
      return "default";
    }
    const presetName = savedColorConfig.presetName;
    return presetName in colorPresets ? presetName : "custom";
  }, [savedColorConfig]);

  const effectiveBorderColor = defaultBorderColor || "#e4e2e2";
  const selectedPreset = effectivePreset;
  const borderColor = effectiveBorderColor;

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewType, setPreviewType] = useState("");
  const [previewVariation, setPreviewVariation] = useState("");
  const [currentStep, setCurrentStep] = useState(0);
  const [maxReachedStep, setMaxReachedStep] = useState(0);

  const {
    loading,
    error,
    submit,
    clearError,
    retryAttempt,
    retryOperation,
    retryLimit,
  } = useStatCardSubmit();

  const isRetrying = loading && retryAttempt > 0;
  const overlayText = isRetrying
    ? `${retryOperation ?? "Retrying"} (Attempt ${Math.min(
        retryAttempt,
        retryLimit,
      )}/${retryLimit})`
    : "Creating your stat cards...";
  const retryStatusText = isRetrying
    ? `${retryOperation ?? "Retrying"} • Attempt ${Math.min(
        retryAttempt,
        retryLimit,
      )}/${retryLimit}`
    : null;

  const friendlyErrorMessage = useMemo(
    () => buildFriendlyErrorMessage(error),
    [error],
  );

  const username = defaultUsername;
  const selectedCards = defaultCardTypes;
  const selectedCardVariants = defaultVariants;
  const showFavoritesByCard = defaultShowFavoritesByCard;
  const hasBorder = defaultBorderEnabled;

  const allSelected = useMemo(
    () => statCardTypes.every((type) => selectedCards.includes(type.id)),
    [selectedCards],
  );

  const previewData = useMemo<MediaStatsPreviewData>(
    () =>
      ({
        mediaType: "anime" as const,
        username: "PreviewUser",
        styles: {
          titleColor,
          backgroundColor,
          textColor,
          circleColor,
          borderColor: hasBorder ? borderColor : undefined,
        },
        stats: {
          count: 456,
          episodesWatched: 1234,
          minutesWatched: 45678,
          meanScore: 85.6,
          standardDeviation: 12.3,
          previousMilestone: 1000,
          currentMilestone: 1500,
          dasharray: "251.2",
          dashoffset: "175.84",
        },
      }) as MediaStatsPreviewData,
    [
      titleColor,
      backgroundColor,
      textColor,
      circleColor,
      borderColor,
      hasBorder,
    ],
  );

  const previewSVG = useMemo(
    () => mediaStatsTemplate(previewData),
    [previewData],
  );

  const handleToggleCard = useCallback(
    (cardId: string) => {
      const [baseId] = cardId.split("-");
      const newTypes = selectedCards.includes(baseId)
        ? selectedCards.filter((id) => id !== baseId)
        : [...selectedCards, baseId];
      setDefaultCardTypes(newTypes);
    },
    [selectedCards, setDefaultCardTypes],
  );

  const handleVariantChange = useCallback(
    (cardType: string, variant: string) => {
      setDefaultVariant(cardType, variant);
    },
    [setDefaultVariant],
  );

  const handleSelectAll = useCallback(() => {
    const selectingAll = selectedCards.length !== statCardTypes.length;
    const newTypes = selectingAll ? statCardTypes.map((type) => type.id) : [];
    setDefaultCardTypes(newTypes);

    if (selectingAll) {
      // Set default variants for newly selected cards
      for (const type of statCardTypes) {
        if (type.variations && !selectedCardVariants[type.id]) {
          setDefaultVariant(type.id, "default");
        }
      }
    }
  }, [
    selectedCards.length,
    selectedCardVariants,
    setDefaultCardTypes,
    setDefaultVariant,
  ]);

  const handleToggleShowFavorites = useCallback(
    (cardId: string) => {
      toggleShowFavorites(cardId);
    },
    [toggleShowFavorites],
  );

  const handleToggleAnimeStatusColors = useCallback(() => {
    setUseAnimeStatusColors(!useAnimeStatusColors);
  }, [useAnimeStatusColors, setUseAnimeStatusColors]);

  const handleToggleMangaStatusColors = useCallback(() => {
    setUseMangaStatusColors(!useMangaStatusColors);
  }, [useMangaStatusColors, setUseMangaStatusColors]);

  const handleToggleShowPiePercentages = useCallback(() => {
    setShowPiePercentages(!showPiePercentages);
  }, [showPiePercentages, setShowPiePercentages]);

  const handleToggleBorder = useCallback(() => {
    setDefaultBorderEnabled(!hasBorder);
  }, [hasBorder, setDefaultBorderEnabled]);

  const updateColorAtIndex = useCallback(
    (index: number, value: ColorValue) => {
      const baseColors =
        savedColorConfig?.colors ?? colorPresets.default.colors;
      const newColors = [...baseColors];
      newColors[index] = value;
      setSavedColorConfig({
        colors: newColors,
        presetName: "custom",
      });
    },
    [savedColorConfig, setSavedColorConfig],
  );

  const handleBorderColorChange = useCallback(
    (value: ColorValue) => {
      if (typeof value !== "string") {
        return;
      }
      const trimmed = value.trim();
      if (!trimmed) {
        setDefaultBorderColor("");
        return;
      }
      const normalized = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
      setDefaultBorderColor(normalized);
    },
    [setDefaultBorderColor],
  );

  const handlePresetChange = useCallback(
    (preset: ColorPresetKey) => {
      if (preset === "custom") {
        setSavedColorConfig({
          colors: effectiveColors,
          presetName: "custom",
        });
        return;
      }
      const colors = colorPresets[preset].colors;
      setSavedColorConfig({
        colors,
        presetName: preset,
      });
    },
    [effectiveColors, setSavedColorConfig],
  );

  const nextStep = useCallback(() => {
    setCurrentStep((prev) => {
      const next = prev >= STEP_COUNT - 1 ? prev : prev + 1;
      setMaxReachedStep((m) => Math.max(m, next));
      return next;
    });
  }, []);

  const prevStep = useCallback(() => {
    setCurrentStep((prev) => (prev === 0 ? 0 : prev - 1));
  }, []);

  const goToStep = useCallback(
    (index: number) => {
      // Only allow backward navigation freely
      if (index <= currentStep) {
        setCurrentStep(index);
        return;
      }

      // Prevent arbitrary forward jumps; allow only if index is less than or equal to
      // the max reached step or immediately next step if validation passes.
      if (index <= maxReachedStep) {
        setCurrentStep(index);
        return;
      }

      if (index === currentStep + 1) {
        // Basic validation: require username when moving beyond step 0
        if (currentStep === 0 && username.trim().length === 0) return;
        setCurrentStep(index);
        setMaxReachedStep((m) => Math.max(m, index));
      }
    },
    [currentStep, maxReachedStep, username],
  );

  const handleSubmit = useCallback(async () => {
    if (username) {
      trackUserSearch(username);
    }

    const uniqueCards = new Set(
      selectedCards.map((card) => {
        const [baseId] = card.split("-");
        return baseId;
      }),
    );

    const finalSelectedCards = Array.from(uniqueCards).map((baseId) => {
      const variant = selectedCardVariants[baseId] || "default";
      return variant === "default" ? baseId : `${baseId}-${variant}`;
    });

    for (const cardType of finalSelectedCards) {
      trackCardGeneration(cardType);
    }

    const showFavoritesConfig = Array.from(uniqueCards).reduce(
      (acc, baseId) => {
        acc[baseId] = !!showFavoritesByCard[baseId];
        return acc;
      },
      {} as Record<string, boolean>,
    );

    const result = await submit({
      username,
      selectedCards: finalSelectedCards,
      colors: [titleColor, backgroundColor, textColor, circleColor],
      showFavoritesByCard: showFavoritesConfig,
      showPiePercentages,
      useAnimeStatusColors,
      useMangaStatusColors,
      borderEnabled: hasBorder,
      borderColor,
    });

    if (result.success && result.userId) {
      const params = new URLSearchParams({
        userId: result.userId,
        username,
      });
      globalThis.location.href = `/user?${params.toString()}`;
    }
  }, [
    username,
    selectedCards,
    selectedCardVariants,
    showFavoritesByCard,
    titleColor,
    backgroundColor,
    textColor,
    circleColor,
    showPiePercentages,
    useAnimeStatusColors,
    useMangaStatusColors,
    hasBorder,
    borderColor,
    submit,
    router,
  ]);

  const updateUsername = useCallback(
    (next: string) => {
      setDefaultUsername(next);
    },
    [setDefaultUsername],
  );

  const openPreview = useCallback((cardType: string, variant?: string) => {
    setPreviewType(cardType);
    setPreviewVariation(variant || "default");
    setPreviewOpen(true);
  }, []);

  const closePreview = useCallback(() => setPreviewOpen(false), []);

  const handlePreview = useCallback(
    (cardType: string, variant?: string) => {
      const variantToUse =
        variant || selectedCardVariants[cardType] || "default";
      openPreview(cardType, variantToUse);
    },
    [selectedCardVariants, openPreview],
  );

  const colorPickers = useMemo<ColorPickerConfig[]>(
    () => [
      {
        id: "titleColor",
        label: "Title",
        value: titleColor,
        onChange: (value: ColorValue) => updateColorAtIndex(0, value),
      },
      {
        id: "backgroundColor",
        label: "Background",
        value: backgroundColor,
        onChange: (value: ColorValue) => updateColorAtIndex(1, value),
      },
      {
        id: "textColor",
        label: "Text",
        value: textColor,
        onChange: (value: ColorValue) => updateColorAtIndex(2, value),
      },
      {
        id: "circleColor",
        label: "Circle",
        value: circleColor,
        onChange: (value: ColorValue) => updateColorAtIndex(3, value),
      },
    ],
    [titleColor, backgroundColor, textColor, circleColor, updateColorAtIndex],
  );

  const borderColorPicker = useMemo<ColorPickerConfig>(
    () => ({
      id: "borderColor",
      label: "Border color",
      value: borderColor,
      onChange: handleBorderColorChange,
      disableGradient: true,
    }),
    [borderColor, handleBorderColorChange],
  );

  const contextObj: GeneratorContextValue = {
    username,
    updateUsername,
    titleColor,
    backgroundColor,
    textColor,
    circleColor,
    borderColor,
    selectedCards,
    selectedCardVariants,
    allSelected,
    selectedPreset,
    previewOpen,
    previewType,
    previewVariation,
    showFavoritesByCard,
    useAnimeStatusColors,
    useMangaStatusColors,
    showPiePercentages,
    hasBorder,
    loading,
    error,
    clearError,
    retryAttempt,
    retryLimit,
    retryOperation,
    isRetrying,
    overlayText,
    retryStatusText,
    friendlyErrorMessage,
    previewSVG,
    previewData,
    colorPickers,
    borderColorPicker,
    currentStep,
    goToStep,
    nextStep,
    prevStep,
    handleToggleCard,
    handleVariantChange,
    handleSelectAll,
    handlePreview,
    handleToggleShowFavorites,
    handleToggleAnimeStatusColors,
    handleToggleMangaStatusColors,
    handleToggleShowPiePercentages,
    handleToggleBorder,
    handleBorderColorChange,
    handlePresetChange,
    handleSubmit,
    openPreview,
    closePreview,
  };

  const contextValue = useMemo<GeneratorContextValue>(
    () => contextObj,
    Object.values(contextObj),
  );

  return (
    <GeneratorContext.Provider value={contextValue}>
      {children}
    </GeneratorContext.Provider>
  );
}

export function useGeneratorContext() {
  const context = useContext(GeneratorContext);
  if (!context) {
    throw new Error(
      "useGeneratorContext must be used within GeneratorProvider",
    );
  }
  return context;
}
