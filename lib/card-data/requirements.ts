import type { CardId } from "@/lib/cards/registry";
import { CARD_BY_ID, CARD_REGISTRY } from "@/lib/cards/registry";
import type { UserDataPart } from "@/lib/server/user-data";

/**
 * Parts to fetch when the card type is not registered. The card API validates
 * the type before it reaches fetching, so this only covers direct callers.
 * @source
 */
const ALL_PARTS: UserDataPart[] = [
  "meta",
  "activity",
  "favourites",
  "statistics",
  "pages",
  "planning",
  "current",
  "rewatched",
  "completed",
];

/** Data parts each card type needs, derived from the card registry. @source */
export const CARD_TYPE_TO_PARTS = Object.fromEntries(
  CARD_REGISTRY.map((card) => [card.id, [...card.dataParts]]),
) as Record<CardId, UserDataPart[]>;

/**
 * Returns the data parts a card needs, ignoring any variation suffix.
 * @param cardName - Card id, optionally suffixed with a variation.
 * @returns The parts to fetch, in the order the card declares them.
 * @source
 */
export function getPartsForCard(cardName: string): UserDataPart[] {
  const [baseCardType] = cardName.split("-");
  const card = CARD_BY_ID.get(baseCardType as CardId);
  return card ? [...card.dataParts] : ALL_PARTS;
}
