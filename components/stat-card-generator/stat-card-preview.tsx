"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import Image from "next/image";
import { useState } from "react";
import { LoadingSpinner } from "@/components/loading-spinner";

interface StatCardPreviewProps {
	isOpen: boolean;
	onClose: () => void;
	cardType: string;
}

/*
 * Configuration objects:
 * - cardImages: Demo URLs for each card type (using sample user ID 542244)
 * - displayNames: User-friendly names for card types
*/
const cardImages: { [key: string]: string } = {
	animeStats: "http://anicards.alpha49.com/api/card.svg?cardType=animeStats&userId=542244",
	socialStats: "http://anicards.alpha49.com/api/card.svg?cardType=socialStats&userId=542244",
	mangaStats: "http://anicards.alpha49.com/api/card.svg?cardType=mangaStats&userId=542244",
	animeGenres: "http://anicards.alpha49.com/api/card.svg?cardType=animeGenres&userId=542244",
	animeTags: "http://anicards.alpha49.com/api/card.svg?cardType=animeTags&userId=542244",
	animeVoiceActors:
		"http://anicards.alpha49.com/api/card.svg?cardType=animeVoiceActors&userId=542244",
	animeStudios: "http://anicards.alpha49.com/api/card.svg?cardType=animeStudios&userId=542244",
	animeStaff: "http://anicards.alpha49.com/api/card.svg?cardType=animeStaff&userId=542244",
	mangaGenres: "http://anicards.alpha49.com/api/card.svg?cardType=mangaGenres&userId=542244",
	mangaTags: "http://anicards.alpha49.com/api/card.svg?cardType=mangaTags&userId=542244",
	mangaStaff: "http://anicards.alpha49.com/api/card.svg?cardType=mangaStaff&userId=542244",
};

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
export function StatCardPreview({ isOpen, onClose, cardType }: StatCardPreviewProps) {
	const [isLoading, setIsLoading] = useState(true);

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className="sm:max-w-[425px] z-[100]">
				<DialogHeader>
					<DialogTitle>
						{/* Fallback to raw cardType if display name not found */}
						Stat Card Preview: {displayNames[cardType] || cardType}
					</DialogTitle>
				</DialogHeader>

				{/* Image container with loading overlay */}
				<div className="relative w-full max-w-[400px] max-h-[300px] mx-auto">
					<div className="relative w-full h-full p-4">
						{isLoading && (
							<div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-50">
								<LoadingSpinner
									className="text-primary"
									text="Loading preview..."
								/>
							</div>
						)}
						<Image
							src={cardImages[cardType] || "/placeholder.svg"}
							alt={`Preview of ${cardType} stat card`}
							width={800}
							height={600}
							className="object-contain w-full h-full relative z-10"
							quality={100} // Max image quality
							onLoadStart={() => setIsLoading(true)}
							onLoad={() => setIsLoading(false)}
							onError={() => setIsLoading(false)}
						/>
					</div>
				</div>

				{/* Preview disclaimer */}
				<div className="mt-4 text-sm text-muted-foreground text-center">
					<p>
						This is a static preview. The actual card will use your Anilist data and
						selected colors.
					</p>
				</div>
			</DialogContent>
		</Dialog>
	);
}
