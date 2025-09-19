import { useState } from "react";
import { useRouter } from "next/navigation";
import { USER_ID_QUERY, USER_STATS_QUERY } from "@/lib/anilist/queries";

interface SubmitParams {
  username: string;
  selectedCards: string[];
  colors: string[];
  showFavoritesByCard: Record<string, boolean>;
  showPiePercentages?: boolean;
  useAnimeStatusColors?: boolean;
  useMangaStatusColors?: boolean;
}

// Only these card types support showFavorites
const FAVORITE_CARD_IDS = [
  "animeVoiceActors",
  "animeStudios",
  "animeStaff",
  "mangaStaff",
];

export function useStatCardSubmit() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const router = useRouter();

  const submit = async ({
    username,
    selectedCards,
    colors,
    showFavoritesByCard,
    showPiePercentages,
    useAnimeStatusColors,
    useMangaStatusColors,
  }: SubmitParams) => {
    setLoading(true);
    setError(null);

    try {
      if (!username.trim())
        throw new Error("Please enter your AniList username");
      if (selectedCards.length === 0)
        throw new Error("Please select at least one stat card");
      if (colors.some((color) => !color))
        throw new Error("All color fields must be filled");

      // Fetch AniList user data
      const userIdResponse = await fetch("/api/anilist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: USER_ID_QUERY,
          variables: { userName: username },
        }),
      });

      if (!userIdResponse.ok) {
        const errorData = await userIdResponse.json();
        throw new Error(
          errorData.error || `HTTP error! status: ${userIdResponse.status}`,
        );
      }
      const userIdData = await userIdResponse.json();

      const statsResponse = await fetch("/api/anilist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: USER_STATS_QUERY,
          variables: { userId: userIdData.User.id },
        }),
      });

      if (!statsResponse.ok) {
        const errorData = await statsResponse.json();
        throw new Error(
          errorData.error || `HTTP error! status: ${statsResponse.status}`,
        );
      }
      const statsData = await statsResponse.json();

      // Store user and card data simultaneously
      await Promise.all([
        fetch("/api/store-users", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.API_AUTH_TOKEN}`,
          },
          body: JSON.stringify({
            userId: userIdData.User.id,
            username,
            stats: statsData,
          }),
        }),
        fetch("/api/store-cards", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.API_AUTH_TOKEN}`,
          },
          body: JSON.stringify({
            userId: userIdData.User.id,
            cards: selectedCards.map((cardId) => {
              const [cardName, rawVariation] = cardId.split("-");
              const variation = rawVariation || "default";
              const baseConfig = {
                cardName,
                variation,
                titleColor: colors[0],
                backgroundColor: colors[1],
                textColor: colors[2],
                circleColor: colors[3],
                showPiePercentages,
                // Attach useStatusColors based on group-specific toggles
                ...(cardName === "animeStatusDistribution" &&
                useAnimeStatusColors
                  ? { useStatusColors: true }
                  : {}),
                ...(cardName === "mangaStatusDistribution" &&
                useMangaStatusColors
                  ? { useStatusColors: true }
                  : {}),
              };
              if (FAVORITE_CARD_IDS.includes(cardName)) {
                return {
                  ...baseConfig,
                  showFavorites: showFavoritesByCard[cardName] || false,
                };
              }
              return baseConfig;
            }),
          }),
        }),
      ]);

      router.push(
        `/user?${new URLSearchParams({
          userId: userIdData.User.id,
          username,
          cards: JSON.stringify(
            selectedCards.map((card) => {
              const [cardName, variation] = card.split("-");
              const obj: Record<string, unknown> = variation
                ? { cardName, variation }
                : { cardName };
              // Copy status color flag and pie percentages from base config creation logic above
              if (
                ["animeStatusDistribution", "mangaStatusDistribution"].includes(
                  cardName,
                )
              ) {
                const statusCard = selectedCards.find((c) =>
                  c.startsWith(cardName),
                );
                // naive inclusion; actual value already persisted server-side
                // Include flag so initial render builds correct URLs
                if (statusCard) {
                  // We don't know which group; infer from name
                  obj.useStatusColors = true; // since toggled when submitted
                }
              }
              if (showPiePercentages) obj.showPiePercentages = true;
              return obj;
            }),
          ),
        })}`,
      );
    } catch (err) {
      if (err instanceof Error) {
        setError(err);
      }
    } finally {
      setLoading(false);
    }
  };

  // New function to clear the error state
  const clearError = () => setError(null);

  return { loading, error, submit, clearError };
}
