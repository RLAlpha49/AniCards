"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Image from "next/image";
import { useState } from "react";
import { LoadingSpinner } from "@/components/loading-spinner";

interface StatCardPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  cardType: string;
  variation?: string;
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
};

// Component for previewing different types of stat cards in a dialog
export function StatCardPreview({
  isOpen,
  onClose,
  cardType,
  variation,
}: StatCardPreviewProps) {
  const [isLoading, setIsLoading] = useState(true);

  // Use the provided variation or default to "default"
  const effectiveVariation = variation ?? "default";

  // Build the preview URL with separate query parameters.
  const baseUrl = "http://anicards.alpha49.com/api/card.svg";
  const urlParams = new URLSearchParams({
    cardType,
    userId: "542244",
    variation: effectiveVariation,
  });
  const previewUrl = `${baseUrl}?${urlParams.toString()}`;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="z-[100] sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            Stat Card Preview: {displayNames[cardType] || cardType} (
            {effectiveVariation})
          </DialogTitle>
        </DialogHeader>

        {/* Image container with loading overlay */}
        <div className="relative mx-auto max-h-[300px] w-full max-w-[400px]">
          <div className="relative h-full w-full p-4">
            {isLoading && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
                <LoadingSpinner
                  className="text-primary"
                  text="Loading preview..."
                />
              </div>
            )}
            <Image
              src={previewUrl}
              alt={`Preview of ${cardType} stat card (${effectiveVariation})`}
              width={800}
              height={600}
              className="relative z-10 h-full w-full object-contain"
              quality={100} // Max image quality
              onLoadStart={() => setIsLoading(true)}
              onLoad={() => setIsLoading(false)}
              onError={() => setIsLoading(false)}
            />
          </div>
        </div>

        {/* Preview disclaimer */}
        <div className="mt-4 text-center text-sm text-muted-foreground">
          <p>
            This is a static preview. The actual card will use your Anilist data
            and selected colors.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
