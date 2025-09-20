"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Image from "next/image";
import { useState, useEffect } from "react";
import { LoadingSpinner } from "@/components/loading-spinner";
import {
  trackCardPreview,
  trackDialogOpen,
  trackDialogClose,
} from "@/lib/utils/google-analytics";

interface StatCardPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  cardType: string;
  variation?: string;
  showFavorites?: boolean;
}

export const displayNames: { [key: string]: string } = {
  animeStats: "Anime Stats",
  socialStats: "Social Stats",
  mangaStats: "Manga Stats",
  animeGenres: "Anime Genres",
  animeTags: "Anime Tags",
  animeVoiceActors: "Anime Voice Actors",
  animeStudios: "Anime Studios",
  animeStaff: "Anime Staff",
  mangaGenres: "Manga Genres",
  mangaTags: "Manga Tags",
  mangaStaff: "Manga Staff",
  animeStatusDistribution: "Anime Statuses",
  mangaStatusDistribution: "Manga Statuses",
  animeFormatDistribution: "Anime Formats",
  mangaFormatDistribution: "Manga Formats",
  animeScoreDistribution: "Anime Scores",
  mangaScoreDistribution: "Manga Scores",
  animeYearDistribution: "Anime Years",
  mangaYearDistribution: "Manga Years",
  animeCountry: "Anime Countries",
  mangaCountry: "Manga Countries",
};

// Component for previewing different types of stat cards in a dialog
export function StatCardPreview({
  isOpen,
  onClose,
  cardType,
  variation,
  showFavorites = false,
}: Readonly<StatCardPreviewProps>) {
  const [isLoading, setIsLoading] = useState(true);

  // Reset loading state when dialog opens or cardType changes
  useEffect(() => {
    if (isOpen && cardType) {
      setIsLoading(true);
    }
  }, [isOpen, cardType, variation]);

  const handleClose = () => {
    trackDialogClose("card_preview");
    onClose();
  };

  // Track when preview opens
  if (isOpen && cardType) {
    trackCardPreview(cardType);
    trackDialogOpen("card_preview");
  }

  // Use the provided variation or default to "default"
  const effectiveVariation = variation ?? "default";

  // Build the preview URL with separate query parameters.
  const baseUrl = "https://anicards.alpha49.com/api/card.svg";
  const urlParams = new URLSearchParams({
    cardType,
    userId: "542244",
    variation: effectiveVariation,
  });
  if (showFavorites) urlParams.append("showFavorites", "true");
  const previewUrl = `${baseUrl}?${urlParams.toString()}`;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="z-[100] border-gray-200/50 bg-gradient-to-br from-white to-gray-50 dark:border-gray-700/50 dark:from-gray-800 dark:to-gray-900 sm:max-w-[500px]">
        <DialogHeader className="pb-4">
          <DialogTitle className="flex items-center gap-2 text-xl font-bold text-gray-800 dark:text-gray-200">
            <span className="h-3 w-3 animate-pulse rounded-full bg-gradient-to-r from-blue-500 to-purple-500"></span>
            Preview: {displayNames[cardType] || cardType}
            <span className="rounded-md bg-gray-100/50 px-2 py-1 text-sm font-normal text-gray-500 dark:bg-gray-800/50 dark:text-gray-400">
              {effectiveVariation}
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* Image container with loading overlay */}
        <div className="relative mx-auto max-h-[350px] min-w-[240px] max-w-[450px] overflow-hidden rounded-xl">
          <div className="relative h-full w-full bg-gradient-to-br from-gray-50/50 to-white/50 p-4 dark:from-gray-800/50 dark:to-gray-700/50">
            {isLoading && (
              <div className="absolute inset-0 z-50 flex items-center justify-center rounded-lg bg-white/90 dark:bg-gray-900/90">
                <LoadingSpinner
                  className="text-blue-500"
                  text="Loading preview..."
                />
              </div>
            )}
            <Image
              src={previewUrl}
              alt={`Preview of ${cardType} stat card (${effectiveVariation})`}
              width={800}
              height={600}
              className="relative z-10 h-full w-full rounded-lg object-contain shadow-lg transition-all duration-300 hover:scale-105"
              quality={100} // Max image quality
              onLoadStart={() => setIsLoading(true)}
              onLoad={() => setIsLoading(false)}
              onError={() => setIsLoading(false)}
            />
          </div>
        </div>

        {/* Preview disclaimer */}
        <div className="mt-4 rounded-lg border border-blue-200/30 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 p-3 dark:border-blue-800/30 dark:from-blue-900/20 dark:to-indigo-900/20">
          <p className="text-center text-sm font-medium text-blue-700 dark:text-blue-300">
            ✨ This is a static preview. The actual card will use your Anilist
            data and selected colors.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
