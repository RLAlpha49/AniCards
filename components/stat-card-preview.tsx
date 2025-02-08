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

const cardImages: { [key: string]: string } = {
	animeStats: "http://localhost:3000/api/card.svg?cardType=animeStats&userId=542244",
	socialStats: "http://localhost:3000/api/card.svg?cardType=socialStats&userId=542244",
	mangaStats: "http://localhost:3000/api/card.svg?cardType=mangaStats&userId=542244",
	animeGenres: "http://localhost:3000/api/card.svg?cardType=animeGenres&userId=542244",
	animeTags: "http://localhost:3000/api/card.svg?cardType=animeTags&userId=542244",
	animeVoiceActors: "http://localhost:3000/api/card.svg?cardType=animeVoiceActors&userId=542244",
	animeStudios: "http://localhost:3000/api/card.svg?cardType=animeStudios&userId=542244",
	animeStaff: "http://localhost:3000/api/card.svg?cardType=animeStaff&userId=542244",
	mangaGenres: "http://localhost:3000/api/card.svg?cardType=mangaGenres&userId=542244",
	mangaTags: "http://localhost:3000/api/card.svg?cardType=mangaTags&userId=542244",
	mangaStaff: "http://localhost:3000/api/card.svg?cardType=mangaStaff&userId=542244",
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

export function StatCardPreview({ isOpen, onClose, cardType }: StatCardPreviewProps) {
	const [isLoading, setIsLoading] = useState(true);

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className="sm:max-w-[425px] z-[100]">
				<DialogHeader>
					<DialogTitle>
						Stat Card Preview: {displayNames[cardType] || cardType}
					</DialogTitle>
				</DialogHeader>
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
							quality={100}
							onLoadStart={() => setIsLoading(true)}
							onLoad={() => setIsLoading(false)}
							onError={() => setIsLoading(false)}
						/>
					</div>
				</div>
				<div className="mt-4 text-sm text-muted-foreground text-center">
					<p>
						This is a static preview. The actual card will use your AniList data and
						selected colors.
					</p>
				</div>
			</DialogContent>
		</Dialog>
	);
}
