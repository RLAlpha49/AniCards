import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Image from "next/image";

interface StatCardPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  cardType: string;
  colors: {
    title: string;
    background: string;
    text: string;
    circle: string;
  };
}

const cardImages: { [key: string]: string } = {
  animeStats: "/images/preview-anime-stats.svg",
  socialStats: "/images/preview-social-stats.svg",
  mangaStats: "/images/preview-manga-stats.svg",
  animeGenres: "/images/preview-anime-genres.svg",
  animeTags: "/images/preview-anime-tags.svg",
  animeVoiceActors: "/images/preview-anime-voice-actors.svg",

  animeStudios: "/images/preview-anime-studios.svg",
  animeStaff: "/images/preview-anime-staff.svg",
  mangaGenres: "/images/preview-manga-genres.svg",
  mangaTags: "/images/preview-manga-tags.svg",
  mangaStaff: "/images/preview-manga-staff.svg",
};

const displayNames: { [key: string]: string } = {
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

export function StatCardPreview({
  isOpen,
  onClose,
  cardType,
  colors,
}: StatCardPreviewProps) {
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
            This is a static preview. The actual card will use your AniList data
            and selected colors.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
