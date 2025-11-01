"use client";

import { useState, useEffect, useMemo } from "react";
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
import { loadDefaultSettings, getPresetColors } from "@/lib/data";
import { useRouter } from "next/navigation";
import {
  trackCardGeneration,
  trackUserSearch,
} from "@/lib/utils/google-analytics";

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
  custom: { colors: ["", "", "", ""], mode: "custom" },
};

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

  // Use our custom hook for managing submission
  const { loading, error, submit, clearError } = useStatCardSubmit();

  // Load defaults on component mount
  useEffect(() => {
    const defaults = loadDefaultSettings();
    const presetColors = getPresetColors(defaults.colorPreset);

    setSelectedPreset(defaults.colorPreset);
    // Apply color preset
    [setTitleColor, setBackgroundColor, setTextColor, setCircleColor].forEach(
      (setter, index) => setter(presetColors[index]),
    );

    // Load default variants directly instead of parsing from card IDs
    const savedVariantsData = localStorage.getItem("anicards-defaultVariants");
    const defaultVariants = savedVariantsData
      ? JSON.parse(savedVariantsData).value
      : {};
    setSelectedCardVariants(defaultVariants);

    // Update card selection logic
    setSelectedCards(defaults.defaultCards);

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
        statCardTypes.forEach((type) => {
          if (type.variations) {
            if (!newObj[type.id]) newObj[type.id] = "default";
          }
        });
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

  // When submitting, we reassemble the selectedCards array. For card types with variants,
  // we append the variant suffix only if it is not "default". (If it is "default", we leave it off.)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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
      return variant !== "default" ? `${baseId}-${variant}` : baseId;
    });

    const showFavoritesConfig = Array.from(uniqueCards).reduce(
      (acc, baseId) => {
        acc[baseId] = !!showFavoritesByCard[baseId];
        return acc;
      },
      {} as Record<string, boolean>,
    );

    // Track card generation for each selected card type
    finalSelectedCards.forEach((cardType) => {
      trackCardGeneration(cardType);
    });

    const result = await submit({
      username,
      selectedCards: finalSelectedCards,
      colors: [titleColor, backgroundColor, textColor, circleColor],
      showFavoritesByCard: showFavoritesConfig,
      showPiePercentages,
      useAnimeStatusColors,
      useMangaStatusColors,
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      {loading && <LoadingOverlay text="Creating your stat cards..." />}
      <DialogContent
        className={cn(
          "z-50 max-h-[calc(100vh-6rem)] overflow-y-auto sm:max-w-[800px] lg:max-w-[900px] xl:max-w-[1000px]",
          "bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-slate-900 dark:via-gray-800 dark:to-blue-950",
          "rounded-2xl border-2 border-blue-100/50 shadow-2xl dark:border-blue-900/30",
          className,
        )}
      >
        <div className="relative z-10">
          <DialogHeader className="-m-6 mb-0 rounded-t-2xl border-b border-blue-100/30 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-pink-500/5 p-6 pb-8 dark:border-blue-800/30 dark:from-blue-600/10 dark:via-purple-600/10 dark:to-pink-600/10">
            <div className="space-y-3 text-center">
              <DialogTitle className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-3xl font-bold text-transparent">
                Generate Your Stat Cards ✨
              </DialogTitle>
              <DialogDescription className="mx-auto max-w-2xl text-lg leading-relaxed text-gray-600 dark:text-gray-300">
                Create beautiful, personalized visualizations of your AniList
                statistics with customizable themes and layouts.
              </DialogDescription>
            </div>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-8 pt-8">
            {/* Step 1: User Details Section */}
            <div className="rounded-2xl border border-blue-100/50 bg-gradient-to-r from-blue-50 to-indigo-50 p-6 shadow-sm transition-shadow duration-300 hover:shadow-md dark:border-blue-900/30 dark:from-blue-950/40 dark:to-indigo-950/40">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 text-sm font-semibold text-white">
                  1
                </div>
                <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
                  Enter Your AniList Username
                </h3>
                <div className="h-px flex-1 bg-gradient-to-r from-blue-200 to-transparent dark:from-blue-800"></div>
              </div>
              <UserDetailsForm
                username={username}
                onUsernameChange={setUsername}
              />
            </div>

            {/* Step 2: Color Customization Section */}
            <div className="rounded-2xl border border-purple-100/50 bg-gradient-to-r from-purple-50 to-pink-50 p-6 shadow-sm transition-shadow duration-300 hover:shadow-md dark:border-purple-900/30 dark:from-purple-950/40 dark:to-pink-950/40">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-500 text-sm font-semibold text-white">
                  2
                </div>
                <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
                  Customize Your Colors
                </h3>
                <div className="h-px flex-1 bg-gradient-to-r from-purple-200 to-transparent dark:from-purple-800"></div>
              </div>

              {/* Color Preset Selector */}
              <div className="mb-4">
                <ColorPresetSelector
                  selectedPreset={selectedPreset}
                  presets={colorPresets}
                  onPresetChange={(preset) => {
                    setSelectedPreset(preset);
                    if (preset !== "custom") {
                      [
                        setTitleColor,
                        setBackgroundColor,
                        setTextColor,
                        setCircleColor,
                      ].forEach((setter, index) =>
                        setter(
                          colorPresets[preset as keyof typeof colorPresets]
                            .colors[index],
                        ),
                      );
                    }
                  }}
                />
              </div>

              {/* Color Picker Grid */}
              <ColorPickerGroup pickers={colorPickers} />

              {/* Live Preview */}
              <div className="mt-4">
                <LivePreview previewSVG={previewSVG} />
              </div>
            </div>

            {/* Step 3: Card Selection Section */}
            <div className="rounded-2xl border border-green-100/50 bg-gradient-to-r from-green-50 to-emerald-50 p-6 shadow-sm transition-shadow duration-300 hover:shadow-md dark:border-green-900/30 dark:from-green-950/40 dark:to-emerald-950/40">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500 text-sm font-semibold text-white">
                  3
                </div>
                <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
                  Choose Your Stat Cards
                </h3>
                <div className="h-px flex-1 bg-gradient-to-r from-green-200 to-transparent dark:from-green-800"></div>
              </div>
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

            {/* Step 4: Advanced Options Section */}
            <div className="rounded-2xl border border-orange-100/50 bg-gradient-to-r from-orange-50 to-red-50 p-6 shadow-sm transition-shadow duration-300 hover:shadow-md dark:border-orange-900/30 dark:from-orange-950/40 dark:to-red-950/40">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-500 text-sm font-semibold text-white">
                  4
                </div>
                <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
                  Advanced Options
                </h3>
                <div className="h-px flex-1 bg-gradient-to-r from-orange-200 to-transparent dark:from-orange-800"></div>
                <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                  Optional
                </span>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {/* Status Color Toggles */}
                <div className="space-y-4">
                  <h4 className="flex items-center gap-2 font-medium text-gray-700 dark:text-gray-300">
                    <span>🎨 Status Color Overrides</span>
                  </h4>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 rounded-xl border border-gray-200/50 bg-white/70 p-4 transition-colors duration-200 hover:border-blue-300/50 dark:border-gray-700/50 dark:bg-gray-800/70 dark:hover:border-blue-600/50">
                      <input
                        id="anime-status-colors"
                        type="checkbox"
                        checked={useAnimeStatusColors}
                        onChange={handleToggleAnimeStatusColors}
                        className="h-4 w-4 cursor-pointer rounded accent-blue-500"
                      />
                      <label
                        htmlFor="anime-status-colors"
                        className="cursor-pointer select-none text-sm leading-tight text-gray-700 dark:text-gray-300"
                      >
                        <span className="font-medium">
                          Anime Status Distribution:
                        </span>{" "}
                        Use fixed status colors
                      </label>
                    </div>
                    <div className="flex items-center gap-3 rounded-xl border border-gray-200/50 bg-white/70 p-4 transition-colors duration-200 hover:border-blue-300/50 dark:border-gray-700/50 dark:bg-gray-800/70 dark:hover:border-blue-600/50">
                      <input
                        id="manga-status-colors"
                        type="checkbox"
                        checked={useMangaStatusColors}
                        onChange={handleToggleMangaStatusColors}
                        className="h-4 w-4 cursor-pointer rounded accent-blue-500"
                      />
                      <label
                        htmlFor="manga-status-colors"
                        className="cursor-pointer select-none text-sm leading-tight text-gray-700 dark:text-gray-300"
                      >
                        <span className="font-medium">
                          Manga Status Distribution:
                        </span>{" "}
                        Use fixed status colors
                      </label>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="flex items-center gap-2 font-medium text-gray-700 dark:text-gray-300">
                    <span>📊 Chart Options</span>
                  </h4>
                  <div className="flex items-center gap-3 rounded-xl border border-gray-200/50 bg-white/70 p-4 transition-colors duration-200 hover:border-blue-300/50 dark:border-gray-700/50 dark:bg-gray-800/70 dark:hover:border-blue-600/50">
                    <input
                      id="pie-percentages-toggle"
                      type="checkbox"
                      checked={showPiePercentages}
                      onChange={handleToggleShowPiePercentages}
                      className="h-4 w-4 cursor-pointer rounded accent-blue-500"
                    />
                    <label
                      htmlFor="pie-percentages-toggle"
                      className="cursor-pointer select-none text-sm leading-tight text-gray-700 dark:text-gray-300"
                    >
                      <span className="font-medium">Pie Charts:</span> Show
                      percentages in legends
                    </label>
                  </div>

                  <div className="rounded-lg border border-blue-200/30 bg-blue-50/50 p-3 dark:border-blue-800/30 dark:bg-blue-950/20">
                    <div className="flex items-start gap-2 text-xs text-blue-700 dark:text-blue-300">
                      <span className="text-sm">ℹ️</span>
                      <div>
                        <p className="mb-1 font-medium">Status Color Guide:</p>
                        <p className="leading-relaxed">
                          Current=🟢, Paused=🟡, Completed=🔵, Dropped=🔴,
                          Planning=⚪
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Generate Button & Status */}
            <div className="space-y-4 pt-6">
              <div className="flex items-center justify-between rounded-xl border border-gray-200/50 bg-gradient-to-r from-gray-50 to-gray-100 p-4 dark:border-gray-600/50 dark:from-gray-800 dark:to-gray-700">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-purple-500 text-lg font-bold text-white">
                    ✨
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800 dark:text-gray-200">
                      Ready to Generate
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {(() => {
                        let cardText;
                        if (selectedCards.length > 0) {
                          cardText =
                            selectedCards.length === 1
                              ? "1 card selected"
                              : `${selectedCards.length} cards selected`;
                        } else {
                          cardText = "No cards selected";
                        }
                        return (
                          <>
                            {cardText}
                            {username && ` • ${username}`}
                          </>
                        );
                      })()}
                    </p>
                  </div>
                </div>
              </div>

              {(() => {
                let buttonLabel;
                if (selectedCards.length === 0) {
                  buttonLabel = <>🚫 Select Cards to Continue</>;
                } else if (!username.trim()) {
                  buttonLabel = <>👤 Enter Username to Continue</>;
                } else {
                  buttonLabel = (
                    <>
                      🚀 Generate {selectedCards.length} Stat Card
                      {selectedCards.length === 1 ? "" : "s"}
                    </>
                  );
                }
                return (
                  <Button
                    type="submit"
                    disabled={selectedCards.length === 0 || !username.trim()}
                    className="w-full transform-gpu rounded-2xl bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 px-8 py-6 text-xl font-semibold text-white shadow-lg transition-all duration-200 hover:scale-[1.02] hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 hover:shadow-xl disabled:cursor-not-allowed disabled:from-gray-400 disabled:via-gray-500 disabled:to-gray-600 disabled:hover:scale-100"
                  >
                    {buttonLabel}
                  </Button>
                );
              })()}
            </div>

            {/* Update Notice */}
            <div className="border-t border-gray-200/50 pt-6 dark:border-gray-700/50">
              <UpdateNotice />
            </div>
          </form>
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
