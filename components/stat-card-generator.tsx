"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LoadingOverlay } from "@/components/loading-spinner";
import { ErrorPopup } from "@/components/error-popup";
import { cn } from "@/lib/utils";
import { StatCardPreview } from "@/components/stat-card-generator/stat-card-preview";
import { mediaStatsTemplate } from "@/lib/svg-templates/media-stats";
import { ColorPresetSelector } from "@/components/stat-card-generator/color-preset-selector";
import { ColorPickerGroup } from "@/components/stat-card-generator/color-picker-group";
import { LivePreview } from "@/components/stat-card-generator/live-preview";
import { StatCardTypeSelection } from "@/components/stat-card-generator/stat-card-type-selection";
import { UpdateNotice } from "@/components/stat-card-generator/update-notice";
import { UserDetailsForm } from "@/components/stat-card-generator/user-details-form";
import { useStatCardSubmit } from "@/hooks/use-stat-card-submit";
import {
  loadDefaultSettings,
  getPresetColors,
  DEFAULT_BORDER_COLOR,
  saveDefaultBorderColor,
  saveDefaultBorderEnabled,
} from "@/lib/data";
import { useRouter } from "next/navigation";
import {
  trackCardGeneration,
  trackUserSearch,
} from "@/lib/utils/google-analytics";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  Palette,
  LayoutGrid,
  Settings2,
  ChevronRight,
  Sparkles,
  CheckCircle2,
  X,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface StatCardGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

/*
 * Configuration objects:
 * - Reusable variation patterns for different card types
 */
const pieBarVariations = [
  { id: "default", label: "Default" },
  { id: "pie", label: "Pie Chart" },
  { id: "bar", label: "Bar Chart" },
];

const verticalHorizontalVariations = [
  { id: "default", label: "Vertical" },
  { id: "horizontal", label: "Horizontal" },
];

const mainStatsVariations = [
  { id: "default", label: "Default" },
  { id: "vertical", label: "Vertical" },
  { id: "compact", label: "Compact" },
  { id: "minimal", label: "Minimal" },
];

const socialStatsVariations = [
  { id: "default", label: "Default" },
  { id: "compact", label: "Compact" },
  { id: "minimal", label: "Minimal" },
];

// Helper function to create card type objects with consistent structure
const createCardType = (
  id: string,
  group: string,
  label: string,
  variations: typeof pieBarVariations,
) => ({
  id,
  group,
  label,
  variations,
});

// Helper arrays for similar card types to reduce repetition
const animeBreakdownCards = [
  { id: "animeGenres", label: "Anime Genres (Top 5 Count)" },
  { id: "animeTags", label: "Anime Tags (Top 5 Count)" },
  { id: "animeVoiceActors", label: "Anime Voice Actors (Top 5 Count)" },
  { id: "animeStudios", label: "Anime Studios (Top 5 Count)" },
  { id: "animeStaff", label: "Anime Staff (Top 5 Count)" },
  {
    id: "animeStatusDistribution",
    label: "Anime Status Distribution (Current, Completed, etc.)",
  },
  { id: "animeFormatDistribution", label: "Anime Format Distribution" },
  { id: "animeCountry", label: "Anime Country" },
];

const mangaBreakdownCards = [
  { id: "mangaGenres", label: "Manga Genres (Top 5 Count)" },
  { id: "mangaTags", label: "Manga Tags (Top 5 Count)" },
  { id: "mangaStaff", label: "Manga Staff (Top 5 Count)" },
  {
    id: "mangaStatusDistribution",
    label: "Manga Status Distribution (Current, Completed, etc.)",
  },
  { id: "mangaFormatDistribution", label: "Manga Format Distribution" },
  { id: "mangaCountry", label: "Manga Country" },
];

const distributionCards = [
  {
    id: "animeScoreDistribution",
    label: "Anime Score Distribution",
    group: "Anime Breakdowns",
  },
  {
    id: "mangaScoreDistribution",
    label: "Manga Score Distribution",
    group: "Manga Breakdowns",
  },
  {
    id: "animeYearDistribution",
    label: "Anime Year Distribution",
    group: "Anime Breakdowns",
  },
  {
    id: "mangaYearDistribution",
    label: "Manga Year Distribution",
    group: "Manga Breakdowns",
  },
];

export const statCardTypes = [
  // Main Stats Cards
  createCardType(
    "animeStats",
    "Main Stats",
    "Anime Stats (Count, Episodes Watched, Minutes Watched, Mean Score, Standard Deviation)",
    mainStatsVariations,
  ),
  createCardType(
    "mangaStats",
    "Main Stats",
    "Manga Stats (Count, Chapters Read, Volumes Read, Mean Score, Standard Deviation)",
    mainStatsVariations,
  ),
  createCardType(
    "socialStats",
    "Main Stats",
    "Social Stats (Total Activities, Followers, Following, Thread Posts/Comments, Reviews)",
    socialStatsVariations,
  ),

  // Anime Breakdown Cards (with pie/bar variations)
  ...animeBreakdownCards.map((card) =>
    createCardType(card.id, "Anime Breakdowns", card.label, pieBarVariations),
  ),

  // Manga Breakdown Cards (with pie/bar variations)
  ...mangaBreakdownCards.map((card) =>
    createCardType(card.id, "Manga Breakdowns", card.label, pieBarVariations),
  ),

  // Distribution Cards (with vertical/horizontal variations)
  ...distributionCards.map((card) =>
    createCardType(
      card.id,
      card.group,
      card.label,
      verticalHorizontalVariations,
    ),
  ),
];

export const colorPresets = {
  default: {
    colors: ["#fe428e", "#141321", "#a9fef7", "#fe428e"],
    mode: "dark",
  },
  anilistLight: {
    colors: ["#3cc8ff", "#FFFFFF", "#333333", "#3cc8ff"],
    mode: "light",
  },
  anilistDark: {
    colors: ["#3cc8ff", "#0b1622", "#E8E8E8", "#3cc8ff"],
    mode: "dark",
  },
  sunset: {
    colors: ["#ff7e5f", "#fff7ed", "#431407", "#ff7e5f"],
    mode: "light",
  },
  ocean: {
    colors: ["#00b4d8", "#f0f9ff", "#03045e", "#00b4d8"],
    mode: "light",
  },
  forest: {
    colors: ["#2d6a4f", "#f0fdf4", "#052e16", "#2d6a4f"],
    mode: "light",
  },
  lavender: {
    colors: ["#7c3aed", "#f5f3ff", "#1e1b4b", "#7c3aed"],
    mode: "light",
  },
  midnight: {
    colors: ["#8b5cf6", "#0f172a", "#e2e8f0", "#8b5cf6"],
    mode: "dark",
  },
  coral: {
    colors: ["#ff6b6b", "#ffe8e8", "#2d3436", "#ff6b6b"],
    mode: "light",
  },
  aurora: {
    colors: ["#10b981", "#042f2e", "#a7f3d0", "#10b981"],
    mode: "dark",
  },
  rosegold: {
    colors: ["#fb7185", "#fff1f2", "#4c0519", "#fb7185"],
    mode: "light",
  },
  galaxy: {
    colors: ["#818cf8", "#1e1b4b", "#c7d2fe", "#818cf8"],
    mode: "dark",
  },
  citrus: {
    colors: ["#f59e0b", "#431407", "#fde68a", "#f59e0b"],
    mode: "dark",
  },
  twilight: {
    colors: ["#c084fc", "#1e1b4b", "#e9d5ff", "#c084fc"],
    mode: "dark",
  },
  seafoam: {
    colors: ["#2dd4bf", "#042f2e", "#ccfbf1", "#2dd4bf"],
    mode: "dark",
  },
  monochromeGray: {
    colors: ["#6b7280", "#f9fafb", "#1f2937", "#9ca3af"],
    mode: "light",
  },
  darkModeBlue: {
    colors: ["#93c5fd", "#0f172a", "#e2e8f0", "#60a5fa"],
    mode: "dark",
  },
  earthyGreen: {
    colors: ["#84cc16", "#fefce8", "#374151", "#a3e635"],
    mode: "light",
  },
  purpleDusk: {
    colors: ["#c084fc", "#4a044a", "#f3e8ff", "#a855f7"],
    mode: "dark",
  },
  redAlert: {
    colors: ["#ef4444", "#000000", "#f8fafc", "#dc2626"],
    mode: "dark",
  },
  goldStandard: {
    colors: ["#facc15", "#111827", "#f0f0f0", "#eab308"],
    mode: "dark",
  },
  cyberpunk: {
    colors: ["#ff4081", "#121212", "#00ffff", "#ff80ab"],
    mode: "dark",
  },
  pastelDreams: {
    colors: ["#a78bfa", "#f0fdfa", "#4b5563", "#c4b5fd"],
    mode: "light",
  },
  vintageSepia: {
    colors: ["#a97142", "#f5e1da", "#5c4033", "#a97142"],
    mode: "light",
  },
  synthwave: {
    colors: ["#ff4ea1", "#2a2a72", "#f1f1f1", "#ff4ea1"],
    mode: "dark",
  },
  solarizedLight: {
    colors: ["#b58900", "#fdf6e3", "#657b83", "#268bd2"],
    mode: "light",
  },
  mint: { colors: ["#00b894", "#dfe6e9", "#2d3436", "#00b894"], mode: "light" },
  bubblegum: {
    colors: ["#ff6f91", "#ffe2e2", "#3f3f3f", "#ff6f91"],
    mode: "light",
  },
  stardust: {
    colors: ["#e0aaff", "#0d0d3f", "#ffffff", "#e0aaff"],
    mode: "dark",
  },
  oceanBreeze: {
    colors: ["#00bcd4", "#e0f7fa", "#00796b", "#00bcd4"],
    mode: "light",
  },
  fire: { colors: ["#ff4500", "#fff5f5", "#8b0000", "#ff4500"], mode: "light" },
  emberGlow: {
    colors: ["#ff6b35", "#1f1a17", "#fde68a", "#ff8b3d"],
    mode: "dark",
  },
  rainforestMist: {
    colors: ["#0f766e", "#f4f9fa", "#0f3c3c", "#34d399"],
    mode: "light",
  },
  polarNight: {
    colors: ["#0ea5e9", "#020617", "#a5f3fc", "#38bdf8"],
    mode: "dark",
  },
  canyonSunrise: {
    colors: ["#ea580c", "#1d1b1e", "#fef3c7", "#fb923c"],
    mode: "light",
  },
  verdantTwilight: {
    colors: ["#22c55e", "#021102", "#dcfce7", "#4ade80"],
    mode: "dark",
  },
  custom: { colors: ["", "", "", ""], mode: "custom" },
};

const STEPS = [
  { id: "user", label: "User", icon: User },
  { id: "colors", label: "Colors", icon: Palette },
  { id: "cards", label: "Cards", icon: LayoutGrid },
  { id: "advanced", label: "Advanced", icon: Settings2 },
];

export function StatCardGenerator({
  isOpen,
  onClose,
  className,
}: Readonly<StatCardGeneratorProps>) {
  // State management for form inputs and UI states
  const [username, setUsername] = useState("");
  const [titleColor, setTitleColor] = useState(colorPresets.default.colors[0]);
  const [backgroundColor, setBackgroundColor] = useState(
    colorPresets.default.colors[1],
  );
  const [textColor, setTextColor] = useState(colorPresets.default.colors[2]);
  const [circleColor, setCircleColor] = useState(
    colorPresets.default.colors[3],
  );
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [selectedCardVariants, setSelectedCardVariants] = useState<
    Record<string, string>
  >({});
  const [selectedPreset, setSelectedPreset] = useState("default");
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
  const [borderColor, setBorderColor] = useState(DEFAULT_BORDER_COLOR);

  const [currentStep, setCurrentStep] = useState(0);

  // Use our custom hook for managing submission
  const { loading, error, submit, clearError } = useStatCardSubmit();

  // Load defaults on component mount
  useEffect(() => {
    const defaults = loadDefaultSettings();
    const presetColors = getPresetColors(defaults.colorPreset);

    setSelectedPreset(defaults.colorPreset);
    // Apply color preset
    const setters = [
      setTitleColor,
      setBackgroundColor,
      setTextColor,
      setCircleColor,
    ];
    for (const [index, setter] of setters.entries()) {
      setter(presetColors[index]);
    }

    // Load default variants directly instead of parsing from card IDs
    const savedVariantsData = localStorage.getItem("anicards-defaultVariants");
    const defaultVariants = savedVariantsData
      ? JSON.parse(savedVariantsData).value
      : {};
    setSelectedCardVariants(defaultVariants);

    // Update card selection logic
    setSelectedCards(defaults.defaultCards);
    setHasBorder(defaults.borderEnabled);
    setBorderColor(defaults.borderColor ?? DEFAULT_BORDER_COLOR);

    // Load default username from local storage
    const savedUsernameData = localStorage.getItem("anicards-defaultUsername");
    const defaultUsername = savedUsernameData
      ? JSON.parse(savedUsernameData).value
      : "";
    setUsername(defaultUsername);

    // Load default showFavoritesByCard from localStorage
    const savedShowFavorites = localStorage.getItem(
      "anicards-defaultShowFavoritesByCard",
    );
    const showFavoritesDefaults = savedShowFavorites
      ? JSON.parse(savedShowFavorites).value
      : {};
    setShowFavoritesByCard(showFavoritesDefaults);

    // Load separate status color preferences
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

  const allSelected = useMemo(
    () => statCardTypes.every((type) => selectedCards.includes(type.id)),
    [selectedCards],
  );

  // Static preview data
  const previewData = {
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
  };

  // Generate preview SVG
  const previewSVG = mediaStatsTemplate(previewData);

  const router = useRouter();

  const handleToggleCard = (cardId: string) => {
    const [baseId] = cardId.split("-"); // Always use base ID for selection
    setSelectedCards((prev) =>
      prev.includes(baseId)
        ? prev.filter((id) => id !== baseId)
        : [...prev, baseId],
    );
  };

  // Handle changes in the variant for a card type that supports variants.
  const handleVariantChange = (cardType: string, variant: string) => {
    setSelectedCardVariants((old) => ({
      ...old,
      [cardType]: variant,
    }));
  };

  const handleSelectAll = () => {
    if (allSelected) {
      // Unselect all cards
      setSelectedCards([]);
    } else {
      // Select all card types (base ids)
      const allIds = statCardTypes.map((type) => type.id);
      setSelectedCards(allIds);
      // For cards with variants, default to "default" if not already set.
      setSelectedCardVariants((old) => {
        const newObj = { ...old };
        for (const type of statCardTypes) {
          if (type.variations && !newObj[type.id]) {
            newObj[type.id] = "default";
          }
        }
        return newObj;
      });
    }
  };

  // Preview expects the base card id and its currently selected variant.
  const handlePreview = (cardType: string) => {
    const variant = selectedCardVariants[cardType] || "default";
    setPreviewType(cardType);
    setPreviewVariation(variant);
    setPreviewOpen(true);
  };

  // Handler to toggle showFavorites for a specific card
  const handleToggleShowFavorites = (cardId: string) => {
    setShowFavoritesByCard((prev) => ({
      ...prev,
      [cardId]: !prev[cardId],
    }));
  };

  const handleToggleAnimeStatusColors = () => {
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
  };

  const handleToggleMangaStatusColors = () => {
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
  };

  const handleToggleShowPiePercentages = () => {
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
  };

  const handleToggleBorder = () => {
    setHasBorder((prev) => {
      const next = !prev;
      saveDefaultBorderEnabled(next);
      return next;
    });
  };

  const handleBorderColorChange = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      setBorderColor("");
      return;
    }
    const normalized = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
    setBorderColor(normalized);
    saveDefaultBorderColor(normalized);
  };

  // When submitting, we reassemble the selectedCards array. For card types with variants,
  // we append the variant suffix only if it is not "default". (If it is "default", we leave it off.)
  const handleSubmit = async () => {
    // Track user search in Google Analytics
    if (username) {
      trackUserSearch(username);
    }

    // Create a Set to ensure unique card IDs
    const uniqueCards = new Set(
      selectedCards.map((card) => {
        const [baseId] = card.split("-"); // Extract base ID without variant
        return baseId;
      }),
    );

    // Convert back to array and apply variants
    const finalSelectedCards = Array.from(uniqueCards).map((baseId) => {
      const variant = selectedCardVariants[baseId] || "default";
      return variant === "default" ? baseId : `${baseId}-${variant}`;
    });

    const showFavoritesConfig = Array.from(uniqueCards).reduce(
      (acc, baseId) => {
        acc[baseId] = !!showFavoritesByCard[baseId];
        return acc;
      },
      {} as Record<string, boolean>,
    );

    // Track card generation for each selected card type
    for (const cardType of finalSelectedCards) {
      trackCardGeneration(cardType);
    }

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

    // Only navigate if submission was successful
    if (result.success && result.userId) {
      // Build navigation URL with full parameters
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
  };

  // Prepare configuration for the color pickers
  const colorPickers = [
    {
      id: "titleColor",
      label: "Title",
      value: titleColor,
      onChange: (value: string) => {
        setTitleColor(value);
        setSelectedPreset("custom");
      },
    },
    {
      id: "backgroundColor",
      label: "Background",
      value: backgroundColor,
      onChange: (value: string) => {
        setBackgroundColor(value);
        setSelectedPreset("custom");
      },
    },
    {
      id: "textColor",
      label: "Text",
      value: textColor,
      onChange: (value: string) => {
        setTextColor(value);
        setSelectedPreset("custom");
      },
    },
    {
      id: "circleColor",
      label: "Circle",
      value: circleColor,
      onChange: (value: string) => {
        setCircleColor(value);
        setSelectedPreset("custom");
      },
    },
  ];

  const borderColorPicker = {
    id: "borderColor",
    label: "Border color",
    value: borderColor || DEFAULT_BORDER_COLOR,
    onChange: handleBorderColorChange,
  };

  const nextStep = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const prevStep = () => {
    if (currentStep === 0) {
      onClose();
      return;
    }

    setCurrentStep((prev) => prev - 1);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className={cn(
          "z-50 flex h-[90vh] max-h-[1000px] w-[95vw] max-w-[1000px] flex-col overflow-hidden p-0",
          "bg-white dark:bg-gray-900",
          "rounded-2xl border-0 shadow-2xl",
          className,
        )}
      >
        {loading && <LoadingOverlay text="Creating your stat cards..." />}
        {/* Header */}
        <div className="relative z-10 flex shrink-0 flex-col border-b border-gray-100 bg-white px-6 py-4 dark:border-gray-800 dark:bg-gray-900">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl font-bold">
              <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                Generate Cards
              </span>
              <Sparkles className="h-5 w-5 text-purple-500" />
            </DialogTitle>
            <DialogDescription className="text-gray-500 dark:text-gray-400">
              Create beautiful, personalized visualizations of your AniList
              stats.
            </DialogDescription>
          </DialogHeader>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-transparent bg-gray-100 text-gray-500 transition hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Steps Navigation */}
          <div className="mt-6 flex w-full items-center px-2">
            <div className="flex w-full items-center justify-between gap-0">
              {STEPS.map((step, index) => {
                const Icon = step.icon;
                const isActive = index === currentStep;
                const isCompleted = index < currentStep;

                let buttonClass =
                  "relative flex h-10 w-10 items-center justify-center rounded-full transition-all duration-300";
                if (isActive) {
                  buttonClass +=
                    " bg-blue-600 text-white shadow-lg shadow-blue-500/30 scale-110";
                } else if (isCompleted) {
                  buttonClass += " bg-green-500 text-white";
                } else {
                  buttonClass += " bg-gray-100 text-gray-400 dark:bg-gray-800";
                }

                let textClass = "text-xs font-medium transition-colors";
                if (isActive) {
                  textClass += " text-blue-600 dark:text-blue-400";
                } else if (isCompleted) {
                  textClass += " text-green-600 dark:text-green-400";
                } else {
                  textClass += " text-gray-400";
                }

                return (
                  <Fragment key={step.id}>
                    {index > 0 && (
                      <span
                        aria-hidden="true"
                        className={cn(
                          "block h-[2px] min-w-[32px] max-w-[230px] flex-1 -translate-y-2.5 self-center transition-colors duration-300",
                          index <= currentStep
                            ? "bg-green-500"
                            : "bg-gray-100 dark:bg-gray-800",
                        )}
                      />
                    )}

                    <div className="flex flex-col items-center gap-2 px-3">
                      <button
                        onClick={() => setCurrentStep(index)}
                        className={cn(buttonClass)}
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="h-5 w-5" />
                        ) : (
                          <Icon className="h-5 w-5" />
                        )}
                      </button>
                      <span className={cn(textClass)}>{step.label}</span>
                    </div>
                  </Fragment>
                );
              })}
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto bg-gray-50/50 p-2 dark:bg-gray-900/50">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="mx-auto max-w-4xl"
            >
              {currentStep === 0 && (
                <div className="space-y-6">
                  <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                    <UserDetailsForm
                      username={username}
                      onUsernameChange={setUsername}
                    />
                  </div>
                  <UpdateNotice />
                </div>
              )}

              {currentStep === 1 && (
                <div className="space-y-6">
                  <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                    <Label className="mb-4 block text-sm font-medium text-gray-500">
                      Live Preview
                    </Label>
                    <LivePreview previewSVG={previewSVG} />
                  </div>
                  <div className="grid gap-6 lg:grid-cols-2">
                    <div className="min-w-0">
                      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                        <ColorPresetSelector
                          selectedPreset={selectedPreset}
                          presets={colorPresets}
                          onPresetChange={(preset) => {
                            setSelectedPreset(preset);
                            if (preset !== "custom") {
                              const setters = [
                                setTitleColor,
                                setBackgroundColor,
                                setTextColor,
                                setCircleColor,
                              ];
                              for (const [index, setter] of setters.entries()) {
                                setter(
                                  colorPresets[
                                    preset as keyof typeof colorPresets
                                  ].colors[index],
                                );
                              }
                            }
                          }}
                        />
                      </div>
                    </div>
                    <div className="min-w-0 space-y-6">
                      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                        <ColorPickerGroup pickers={colorPickers} />
                      </div>
                      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label className="text-base">Card Border</Label>
                            <p className="text-xs text-muted-foreground">
                              Optional frame around the entire card
                            </p>
                          </div>
                          <Switch
                            checked={hasBorder}
                            onCheckedChange={handleToggleBorder}
                          />
                        </div>
                        {hasBorder && (
                          <div className="mt-4">
                            <ColorPickerGroup pickers={[borderColorPicker]} />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 2 && (
                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                  <StatCardTypeSelection
                    cardTypes={statCardTypes}
                    selectedCards={selectedCards}
                    selectedCardVariants={selectedCardVariants}
                    allSelected={allSelected}
                    onToggle={handleToggleCard}
                    onSelectAll={handleSelectAll}
                    onVariantChange={handleVariantChange}
                    onPreview={handlePreview}
                    showFavoritesByCard={showFavoritesByCard}
                    onToggleShowFavorites={handleToggleShowFavorites}
                  />
                </div>
              )}

              {currentStep === 3 && (
                <div className="space-y-6">
                  <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                    <h3 className="mb-4 text-lg font-semibold">
                      Advanced Options
                    </h3>
                    <div className="grid gap-6 md:grid-cols-2">
                      <div className="space-y-4">
                        <Label className="text-sm font-medium text-gray-500">
                          Status Colors
                        </Label>
                        <div className="flex items-center justify-between rounded-lg border p-4 dark:border-gray-800">
                          <div className="space-y-0.5">
                            <Label className="text-base">
                              Anime Status Colors
                            </Label>
                            <p className="text-xs text-muted-foreground">
                              Use fixed colors for status distribution
                            </p>
                          </div>
                          <Switch
                            checked={useAnimeStatusColors}
                            onCheckedChange={handleToggleAnimeStatusColors}
                          />
                        </div>
                        <div className="flex items-center justify-between rounded-lg border p-4 dark:border-gray-800">
                          <div className="space-y-0.5">
                            <Label className="text-base">
                              Manga Status Colors
                            </Label>
                            <p className="text-xs text-muted-foreground">
                              Use fixed colors for status distribution
                            </p>
                          </div>
                          <Switch
                            checked={useMangaStatusColors}
                            onCheckedChange={handleToggleMangaStatusColors}
                          />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <Label className="text-sm font-medium text-gray-500">
                          Chart Options
                        </Label>
                        <div className="flex items-center justify-between rounded-lg border p-4 dark:border-gray-800">
                          <div className="space-y-0.5">
                            <Label className="text-base">Pie Percentages</Label>
                            <p className="text-xs text-muted-foreground">
                              Show percentages in legends
                            </p>
                          </div>
                          <Switch
                            checked={showPiePercentages}
                            onCheckedChange={handleToggleShowPiePercentages}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4 dark:border-blue-900/30 dark:bg-blue-900/10">
                    <div className="flex gap-3">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400">
                        <span className="text-xs font-bold">i</span>
                      </div>
                      <div className="space-y-1 text-sm text-blue-900 dark:text-blue-100">
                        <p className="font-medium">Status Color Guide</p>
                        <p className="text-blue-700 dark:text-blue-300">
                          Current=🟢, Paused=🟡, Completed=🔵, Dropped=🔴,
                          Planning=⚪
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer Actions */}
        <div className="flex shrink-0 items-center justify-between border-t border-gray-100 bg-white px-6 py-4 dark:border-gray-800 dark:bg-gray-900">
          <Button
            variant="ghost"
            onClick={prevStep}
            disabled={loading}
            className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
          >
            Back
          </Button>

          <div className="flex items-center gap-3">
            {currentStep === STEPS.length - 1 ? (
              <Button
                onClick={handleSubmit}
                disabled={selectedCards.length === 0 || !username.trim()}
                className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 px-8 font-semibold text-white shadow-lg transition-all hover:scale-105 hover:shadow-xl disabled:opacity-50"
              >
                Generate{" "}
                {selectedCards.length > 0 && `(${selectedCards.length})`}
                <Sparkles className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={nextStep}
                disabled={currentStep === 0 && !username.trim()}
                className="bg-gray-900 text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
              >
                Next Step
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>

      <ErrorPopup
        isOpen={!!error}
        onClose={clearError}
        title="Submission Error"
        description={error?.message || "An error occurred."}
      />
      <StatCardPreview
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        cardType={previewType}
        variation={previewVariation}
        showFavorites={showFavoritesByCard[previewType]}
      />
    </Dialog>
  );
}
