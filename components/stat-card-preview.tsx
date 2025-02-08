import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import Image from "next/image";

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
	const imageSrc = cardImages[cardType] || "/placeholder.svg";

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className="sm:max-w-[425px]">
				<DialogHeader>
					<DialogTitle>
						Stat Card Preview: {displayNames[cardType] || cardType}
					</DialogTitle>
				</DialogHeader>
				<div className="relative w-full max-w-[400px] max-h-[300px] mx-auto">
					<div className="relative w-full h-full p-4">
						<Image
							src={imageSrc}
							alt={`Preview of ${cardType} stat card`}
							width={800}
							height={600}
							className="object-contain w-full h-full"
							quality={100}
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
