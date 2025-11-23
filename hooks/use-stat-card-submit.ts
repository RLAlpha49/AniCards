import { useState } from "react";
import { USER_ID_QUERY, USER_STATS_QUERY } from "@/lib/anilist/queries";

interface SubmitParams {
  username: string;
  selectedCards: string[];
  colors: string[];
  showFavoritesByCard: Record<string, boolean>;
  showPiePercentages?: boolean;
  useAnimeStatusColors?: boolean;
  useMangaStatusColors?: boolean;
  borderEnabled?: boolean;
  borderColor?: string;
}

// Only these card types support showFavorites
const FAVORITE_CARD_IDS = new Set([
  "animeVoiceActors",
  "animeStudios",
  "animeStaff",
  "mangaStaff",
]);

export function useStatCardSubmit() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const submit = async ({
    username,
    selectedCards,
    colors,
    showFavoritesByCard,
    showPiePercentages,
    useAnimeStatusColors,
    useMangaStatusColors,
    borderEnabled,
    borderColor,
  }: SubmitParams): Promise<{ success: boolean; userId?: string }> => {
    setLoading(true);
    setError(null);

    try {
      if (!username.trim())
        throw new Error("Please enter your AniList username");
      if (selectedCards.length === 0)
        throw new Error("Please select at least one stat card");
      if (colors.some((color) => !color))
        throw new Error("All color fields must be filled");
      if (borderEnabled && !borderColor)
        throw new Error("Border color must be set when the border is enabled");

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
                ...(borderEnabled && borderColor
                  ? { borderColor }
                  : {}),
              };
              if (FAVORITE_CARD_IDS.has(cardName)) {
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

      setLoading(false);
      return { success: true, userId: userIdData.User.id };
    } catch (err) {
      setLoading(false);
      if (err instanceof Error) {
        setError(err);
      }
      return { success: false };
    }
  };

  // New function to clear the error state
  const clearError = () => setError(null);

  return { loading, error, submit, clearError };
}
