/* eslint-disable @next/next/no-img-element */
"use client";

import { motion, AnimatePresence } from "framer-motion";
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
import { Eye, Info } from "lucide-react";
import { cn } from "@/lib/utils";

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
      <DialogContent className="z-[100] max-h-[90vh] overflow-hidden border-0 bg-transparent p-0 shadow-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden rounded-3xl border border-slate-200/50 bg-white/95 shadow-2xl backdrop-blur-xl dark:border-slate-700/50 dark:bg-slate-900/95"
        >
          {/* Header */}
          <div className="relative border-b border-slate-200/50 bg-gradient-to-r from-slate-50 to-white p-5 dark:border-slate-700/50 dark:from-slate-800/50 dark:to-slate-900">
            {/* Decorative gradient accent */}
            <div className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />

            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 shadow-md shadow-blue-500/25">
                  <Eye className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-slate-900 dark:text-white">
                      {displayNames[cardType] || cardType}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                      {effectiveVariation}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Card Preview
                  </p>
                </div>
              </DialogTitle>
            </DialogHeader>
          </div>

          {/* Preview Content */}
          <div className="relative bg-gradient-to-br from-slate-100/50 via-white to-slate-50/80 p-6 dark:from-slate-900/50 dark:via-slate-900 dark:to-slate-800/50">
            {/* Image container with glow effect */}
            <div className="relative mx-auto">
              {/* Glow Effect */}
              <div className="absolute -inset-4 rounded-3xl bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100" />

              <div className="relative overflow-hidden rounded-2xl border border-slate-200/50 bg-white shadow-xl shadow-slate-200/50 dark:border-slate-700/50 dark:bg-slate-800 dark:shadow-slate-900/50">
                {/* Loading Overlay */}
                <AnimatePresence>
                  {isLoading && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-white/90 backdrop-blur-sm dark:bg-slate-900/90"
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
                        <LoadingSpinner className="h-6 w-6 text-blue-500" />
                      </div>
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                        Loading preview...
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Image */}
                <div className="justify-items-center p-4">
                  <img
                    src={previewUrl}
                    alt={`Preview of ${cardType} stat card (${effectiveVariation})`}
                    className={cn(
                      "rounded-lg object-contain transition-all duration-500",
                      isLoading
                        ? "scale-95 opacity-0"
                        : "scale-100 opacity-100",
                    )}
                    onLoad={() => setIsLoading(false)}
                    onError={() => setIsLoading(false)}
                    decoding="async"
                    loading="lazy"
                  />
                </div>
              </div>
            </div>

            {/* Info Footer */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mt-5 flex items-center justify-center gap-2 rounded-xl border border-blue-200/50 bg-gradient-to-r from-blue-50 to-indigo-50/50 p-3 dark:border-blue-800/30 dark:from-blue-950/30 dark:to-indigo-950/20"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500 shadow-md shadow-blue-500/25">
                <Info className="h-3.5 w-3.5 text-white" />
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                <span className="font-semibold text-slate-900 dark:text-white">
                  Sample data shown.
                </span>{" "}
                Your card will display your real AniList stats.
              </p>
            </motion.div>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
