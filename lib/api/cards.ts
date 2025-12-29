import { parseResponsePayload, getResponseErrorMessage } from "@/lib/utils";
import type { ColorValue } from "@/lib/types/card";

/**
 * Shape of card data received from the server.
 * @source (moved from lib/stores/user-page-editor.ts)
 */
export interface ServerCardData {
  cardName: string;
  variation?: string;
  colorPreset?: string;
  titleColor?: ColorValue;
  backgroundColor?: ColorValue;
  textColor?: ColorValue;
  circleColor?: ColorValue;
  borderColor?: string;
  borderRadius?: number;
  useStatusColors?: boolean;
  showPiePercentages?: boolean;
  showFavorites?: boolean;
  gridCols?: number;
  gridRows?: number;
  useCustomSettings?: boolean;
  disabled?: boolean;
}

/**
 * Shape of global settings received from the server.
 * @source (moved from lib/stores/user-page-editor.ts)
 */
export interface ServerGlobalSettings {
  colorPreset?: string;
  titleColor?: ColorValue;
  backgroundColor?: ColorValue;
  textColor?: ColorValue;
  circleColor?: ColorValue;
  borderEnabled?: boolean;
  borderColor?: string;
  borderRadius?: number;
  useStatusColors?: boolean;
  showPiePercentages?: boolean;
  showFavorites?: boolean;
  gridCols?: number;
  gridRows?: number;
}

export type FetchUserCardsSuccess = {
  cards: ServerCardData[];
  globalSettings?: ServerGlobalSettings;
};

export type FetchUserCardsError = { error: string; notFound?: true };

/**
 * Fetch cards and optional global settings for a user from the server.
 * Behavior and error handling preserved from previous hook-local implementations.
 */
export async function fetchUserCards(
  userId: string,
): Promise<FetchUserCardsSuccess | FetchUserCardsError> {
  try {
    const res = await fetch(`/api/get-cards?userId=${userId}`);
    const payload = await parseResponsePayload(res);

    if (!res.ok) {
      const msg = getResponseErrorMessage(res, payload);
      if (res.status === 404) return { error: msg, notFound: true };
      return { error: msg };
    }

    const data = payload as {
      cards?: ServerCardData[];
      globalSettings?: ServerGlobalSettings;
    };
    return { cards: data.cards || [], globalSettings: data.globalSettings };
  } catch (err) {
    console.error("Error fetching cards:", err);
    return { error: "Failed to fetch cards" };
  }
}
