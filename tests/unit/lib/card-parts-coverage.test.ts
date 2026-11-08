import { describe, expect, it } from "bun:test";
import { displayNames } from "@/lib/card-data/validation";
import {
  CARD_TYPE_TO_PARTS,
  getPartsForCard,
} from "@/lib/card-data/requirements";

describe("card data requirements", () => {
  it("maps every supported card type to its data parts", () => {
    expect(Object.keys(CARD_TYPE_TO_PARTS).sort()).toEqual(
      Object.keys(displayNames).sort(),
    );
    for (const cardType of Object.keys(displayNames)) {
      expect(getPartsForCard(`${cardType}-default`)).toEqual(
        CARD_TYPE_TO_PARTS[cardType as keyof typeof CARD_TYPE_TO_PARTS],
      );
    }
  });
});
