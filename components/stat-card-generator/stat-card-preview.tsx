/* eslint-disable @next/next/no-img-element */
"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useState, useEffect } from "react";
import { LoadingSpinner } from "@/components/loading-spinner";
import {
  trackCardPreview,
  trackDialogOpen,
  trackDialogClose,
} from "@/lib/utils/google-analytics";

/**
 * Props to control the stat card preview dialog.
 * @property isOpen - Whether the dialog is visible.
 * @property onClose - Called when the dialog should close.
 * @property cardType - Key of the card type to render.
 * @property variation - Optional card variation id.
 * @property showFavorites - Whether to force showing favorites in preview data.
 * @source
 */
interface StatCardPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  cardType: string;
  variation?: string;
  showFavorites?: boolean;
}

/**
 * Human friendly display names for the `cardType` values.
 * @source
 */
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

/**
 * Dialog component used to preview stat cards.
 * The preview fetches a sample SVG from a preview API and displays the
 * rendered image with a loading state.
 * @param isOpen - Controls whether the dialog is shown.
 * @param onClose - Callback to close the dialog.
 * @param cardType - Card type key for the preview image.
 * @param variation - Optional variation to render, defaults to 'default'.
 * @param showFavorites - If true, show favorites in the sample data.
 * @returns React element wrapping the dialog with the fetched preview image.
 * @source
 */
export function StatCardPreview({
  isOpen,
  onClose,
  cardType,
  variation,
  showFavorites = false,
}: Readonly<StatCardPreviewProps>) {
  const [isLoading, setIsLoading] = useState(true);

  // Reset loading state when dialog opens or cardType changes.
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
    // Sample user used to generate demo preview SVGs — not the viewer's user id.
    userId: "542244",
    variation: effectiveVariation,
  });
  if (showFavorites) urlParams.append("showFavorites", "true");
  const previewUrl = `${baseUrl}?${urlParams.toString()}`;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="z-[100] border-0 bg-white/95 p-0 shadow-2xl backdrop-blur-xl dark:bg-gray-900/95 sm:max-w-[600px]">
        <div className="border-b border-gray-100 p-6 dark:border-gray-800">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-xl font-bold">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                <span className="text-lg">👁️</span>
              </span>
              <div>
                <div className="flex items-center gap-2">
                  {displayNames[cardType] || cardType}
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                    {effectiveVariation}
                  </span>
                </div>
              </div>
            </DialogTitle>
          </DialogHeader>
        </div>

        <div className="bg-gray-50/50 p-8 dark:bg-gray-900/50">
          {/* Image container with loading overlay */}
          <div
            className="relative mx-auto overflow-hidden bg-white shadow-sm ring-1 ring-gray-200 dark:bg-gray-800 dark:ring-gray-700"
            style={{ borderRadius: "8px" }}
          >
            {isLoading && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm dark:bg-gray-900/80">
                <LoadingSpinner
                  className="text-blue-500"
                  text="Loading preview..."
                />
              </div>
            )}
            <div className="p-4">
              <img
                src={previewUrl}
                alt={`Preview of ${cardType} stat card (${effectiveVariation})`}
                width={800}
                height={600}
                className="h-auto w-full object-contain transition-transform duration-500 hover:scale-[1.02]"
                style={{ borderRadius: "8px" }}
                onLoad={() => setIsLoading(false)}
                onError={() => setIsLoading(false)}
                decoding="async"
                loading="lazy"
              />
            </div>
          </div>

          {/* Preview disclaimer */}
          <div className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
              i
            </span>
            <p>Preview uses sample data. Your card will use your real stats.</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
