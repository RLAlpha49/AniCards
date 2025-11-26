"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useStatCardSubmit } from "@/hooks/use-stat-card-submit";
import {
  loadDefaultSettings,
  getPresetColors,
  DEFAULT_BORDER_COLOR,
  saveDefaultBorderColor,
  saveDefaultBorderEnabled,
  saveDefaultCardTypes,
  saveColorConfig,
  loadColorConfig,
} from "@/lib/data";
import { mediaStatsTemplate } from "@/lib/svg-templates/media-stats";
import {
  trackCardGeneration,
  trackUserSearch,
} from "@/lib/utils/google-analytics";
import { colorPresets, statCardTypes } from "./constants";
import type { ColorValue } from "@/lib/types/card";
import { isGradient, colorValueToString } from "@/lib/utils";

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
  borderColor: ColorValue;
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
  const [username, setUsername] = useState("");
  const [titleColor, setTitleColor] = useState<ColorValue>(
    colorPresets.default.colors[0],
  );
  const [backgroundColor, setBackgroundColor] = useState<ColorValue>(
    colorPresets.default.colors[1],
  );
  const [textColor, setTextColor] = useState<ColorValue>(
    colorPresets.default.colors[2],
  );
  const [circleColor, setCircleColor] = useState<ColorValue>(
    colorPresets.default.colors[3],
  );
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [selectedCardVariants, setSelectedCardVariants] = useState<
    Record<string, string>
  >({});
  const [selectedPreset, setSelectedPreset] =
    useState<ColorPresetKey>("default");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewType, setPreviewType] = useState("");
  const [previewVariation, setPreviewVariation] = useState("");
  const [showFavoritesByCard, setShowFavoritesByCard] = useState<
    Record<string, boolean>
  >({});
  const [useAnimeStatusColors, setUseAnimeStatusColors] = useState(false);
  const [useMangaStatusColors, setUseMangaStatusColors] = useState(false);
  const [showPiePercentages, setShowPiePercentages] = useState(false);
  const [hasBorder, setHasBorder] = useState(false);
  const [borderColor, setBorderColor] =
    useState<ColorValue>(DEFAULT_BORDER_COLOR);
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

  useEffect(() => {
    const defaults = loadDefaultSettings();

    // Try to load saved color config first (preferred), fallback to preset
    const savedColors = loadColorConfig();
    if (savedColors) {
      const { colors, presetName } = savedColors;
      setTitleColor(colors[0]);
      setBackgroundColor(colors[1]);
      setTextColor(colors[2]);
      setCircleColor(colors[3]);
      // Set preset if it's a valid key, otherwise "custom"
      const validPreset =
        presetName in colorPresets ? (presetName) : "custom";
      setSelectedPreset(validPreset);
    } else {
      // Fallback to legacy preset-only loading
      const presetColors = getPresetColors(defaults.colorPreset);
      const validPreset =
        defaults.colorPreset in colorPresets
          ? (defaults.colorPreset)
          : "default";
      setSelectedPreset(validPreset);
      const setters = [
        setTitleColor,
        setBackgroundColor,
        setTextColor,
        setCircleColor,
      ];
      for (const [index, setter] of setters.entries()) {
        setter(presetColors[index]);
      }
    }

    const savedVariantsData = localStorage.getItem("anicards-defaultVariants");
    const defaultVariants = savedVariantsData
      ? JSON.parse(savedVariantsData).value
      : {};
    setSelectedCardVariants(defaultVariants);

    setSelectedCards(defaults.defaultCards);
    setHasBorder(defaults.borderEnabled);
    setBorderColor(defaults.borderColor ?? DEFAULT_BORDER_COLOR);

    const savedUsernameData = localStorage.getItem("anicards-defaultUsername");
    const defaultUsername = savedUsernameData
      ? JSON.parse(savedUsernameData).value
      : "";
    setUsername(defaultUsername);

    const savedShowFavorites = localStorage.getItem(
      "anicards-defaultShowFavoritesByCard",
    );
    const showFavoritesDefaults = savedShowFavorites
      ? JSON.parse(savedShowFavorites).value
      : {};
    setShowFavoritesByCard(showFavoritesDefaults);

    const savedAnimeStatusColors = localStorage.getItem(
      "anicards-useAnimeStatusColors",
    );
    if (savedAnimeStatusColors) {
      try {
        setUseAnimeStatusColors(JSON.parse(savedAnimeStatusColors).value);
      } catch {}
    }

    const savedMangaStatusColors = localStorage.getItem(
      "anicards-useMangaStatusColors",
    );
    if (savedMangaStatusColors) {
      try {
        setUseMangaStatusColors(JSON.parse(savedMangaStatusColors).value);
      } catch {}
    }

    const savedShowPiePercentages = localStorage.getItem(
      "anicards-showPiePercentages",
    );
    if (savedShowPiePercentages) {
      try {
        setShowPiePercentages(JSON.parse(savedShowPiePercentages).value);
      } catch {}
    }
  }, []);

  // Auto-save colors whenever they change
  useEffect(() => {
    // Only save after initial load (colors won't be empty strings from preset)
    const hasValidColors =
      titleColor && backgroundColor && textColor && circleColor;
    if (hasValidColors) {
      saveColorConfig(
        [titleColor, backgroundColor, textColor, circleColor],
        selectedPreset,
      );
    }
  }, [titleColor, backgroundColor, textColor, circleColor, selectedPreset]);

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

  const handleToggleCard = useCallback((cardId: string) => {
    const [baseId] = cardId.split("-");
    updateSelectedCards((prev) =>
      prev.includes(baseId)
        ? prev.filter((id) => id !== baseId)
        : [...prev, baseId],
    );
  }, []);

  const handleVariantChange = useCallback(
    (cardType: string, variant: string) => {
      updateSelectedCardVariants((old) => ({
        ...old,
        [cardType]: variant,
      }));
    },
    [],
  );

  const handleSelectAll = useCallback(() => {
    const selectingAll = selectedCards.length !== statCardTypes.length;
    updateSelectedCards(
      selectingAll ? statCardTypes.map((type) => type.id) : [],
    );

    if (selectingAll) {
      updateSelectedCardVariants((old) => {
        const newObj = { ...old };
        for (const type of statCardTypes) {
          if (type.variations && !newObj[type.id]) {
            newObj[type.id] = "default";
          }
        }
        return newObj;
      });
    }
  }, [selectedCards.length]);

  const handleToggleShowFavorites = useCallback((cardId: string) => {
    updateShowFavoritesByCard((prev) => ({
      ...prev,
      [cardId]: !prev[cardId],
    }));
  }, []);

  const handleToggleAnimeStatusColors = useCallback(() => {
    setUseAnimeStatusColors((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(
          "anicards-useAnimeStatusColors",
          JSON.stringify({ value: next }),
        );
      } catch {}
      return next;
    });
  }, []);

  const handleToggleMangaStatusColors = useCallback(() => {
    setUseMangaStatusColors((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(
          "anicards-useMangaStatusColors",
          JSON.stringify({ value: next }),
        );
      } catch {}
      return next;
    });
  }, []);

  const handleToggleShowPiePercentages = useCallback(() => {
    setShowPiePercentages((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(
          "anicards-showPiePercentages",
          JSON.stringify({ value: next }),
        );
      } catch {}
      return next;
    });
  }, []);

  const handleToggleBorder = useCallback(() => {
    setHasBorder((prev) => {
      const next = !prev;
      saveDefaultBorderEnabled(next);
      return next;
    });
  }, []);

  const handleBorderColorChange = useCallback((value: ColorValue) => {
    // Border color currently only supports solid colors
    if (isGradient(value)) {
      return;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      setBorderColor("");
      return;
    }
    const normalized = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
    setBorderColor(normalized);
    saveDefaultBorderColor(normalized);
  }, []);

  const handlePresetChange = useCallback((preset: ColorPresetKey) => {
    setSelectedPreset(preset);
    if (preset === "custom") {
      return;
    }
    const colors = colorPresets[preset].colors;
    const setters = [
      setTitleColor,
      setBackgroundColor,
      setTextColor,
      setCircleColor,
    ];
    for (const [index, setter] of setters.entries()) {
      setter(colors[index]);
    }
  }, []);

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
      borderColor: colorValueToString(borderColor),
    });

    if (result.success && result.userId) {
      const params = new URLSearchParams({
        userId: result.userId,
        username,
        cards: JSON.stringify(
          finalSelectedCards.map((card) => {
            const [cardName, variation] = card.split("-");
            const obj: Record<string, unknown> = variation
              ? { cardName, variation }
              : { cardName };
            const isAnimeStatus = cardName === "animeStatusDistribution";
            const isMangaStatus = cardName === "mangaStatusDistribution";
            if (
              (isAnimeStatus && useAnimeStatusColors) ||
              (isMangaStatus && useMangaStatusColors)
            ) {
              obj.useStatusColors = true;
            }
            if (showPiePercentages) obj.showPiePercentages = true;
            return obj;
          }),
        ),
      });
      router.push(`/user?${params.toString()}`);
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

  /* ---------- Persistence-aware setters and behaviors ---------- */

  const updateUsername = useCallback((next: string) => {
    setUsername(next);
    try {
      localStorage.setItem(
        "anicards-defaultUsername",
        JSON.stringify({ value: next, lastModified: new Date().toISOString() }),
      );
    } catch {}
  }, []);

  const updateSelectedCards = useCallback(
    (next: string[] | ((prev: string[]) => string[])) => {
      if (typeof next === "function") {
        setSelectedCards((prev) => {
          const nextArr = next(prev);
          try {
            saveDefaultCardTypes(nextArr);
          } catch {}
          return nextArr;
        });
        return;
      }
      setSelectedCards(next);
      try {
        saveDefaultCardTypes(next);
      } catch {}
    },
    [],
  );

  const updateSelectedCardVariants = useCallback(
    (
      next:
        | Record<string, string>
        | ((prev: Record<string, string>) => Record<string, string>),
    ) => {
      if (typeof next === "function") {
        setSelectedCardVariants((prev) => {
          const newObj = (
            next as (p: Record<string, string>) => Record<string, string>
          )(prev);
          try {
            localStorage.setItem(
              "anicards-defaultVariants",
              JSON.stringify({
                value: newObj,
                lastModified: new Date().toISOString(),
              }),
            );
          } catch {}
          return newObj;
        });
        return;
      }
      setSelectedCardVariants(next);
      try {
        localStorage.setItem(
          "anicards-defaultVariants",
          JSON.stringify({
            value: next,
            lastModified: new Date().toISOString(),
          }),
        );
      } catch {}
    },
    [],
  );

  const updateShowFavoritesByCard = useCallback(
    (
      next:
        | Record<string, boolean>
        | ((prev: Record<string, boolean>) => Record<string, boolean>),
    ) => {
      if (typeof next === "function") {
        setShowFavoritesByCard((prev) => {
          const newObj = (
            next as (p: Record<string, boolean>) => Record<string, boolean>
          )(prev);
          try {
            localStorage.setItem(
              "anicards-defaultShowFavoritesByCard",
              JSON.stringify({
                value: newObj,
                lastModified: new Date().toISOString(),
              }),
            );
          } catch {}
          return newObj;
        });
        return;
      }
      setShowFavoritesByCard(next);
      try {
        localStorage.setItem(
          "anicards-defaultShowFavoritesByCard",
          JSON.stringify({
            value: next,
            lastModified: new Date().toISOString(),
          }),
        );
      } catch {}
    },
    [],
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
        onChange: (value: ColorValue) => {
          setTitleColor(value);
          setSelectedPreset("custom");
        },
      },
      {
        id: "backgroundColor",
        label: "Background",
        value: backgroundColor,
        onChange: (value: ColorValue) => {
          setBackgroundColor(value);
          setSelectedPreset("custom");
        },
      },
      {
        id: "textColor",
        label: "Text",
        value: textColor,
        onChange: (value: ColorValue) => {
          setTextColor(value);
          setSelectedPreset("custom");
        },
      },
      {
        id: "circleColor",
        label: "Circle",
        value: circleColor,
        onChange: (value: ColorValue) => {
          setCircleColor(value);
          setSelectedPreset("custom");
        },
      },
    ],
    [titleColor, backgroundColor, textColor, circleColor],
  );

  const borderColorPicker = useMemo<ColorPickerConfig>(
    () => ({
      id: "borderColor",
      label: "Border color",
      value: borderColor || DEFAULT_BORDER_COLOR,
      onChange: handleBorderColorChange,
      disableGradient: true,
    }),
    [borderColor, handleBorderColorChange],
  );

  const contextValue = useMemo<GeneratorContextValue>(
    () => ({
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
    }),
    [
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
    ],
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
