import { mockPretextStressUserRecord } from "@/tests/e2e/fixtures/pretext-stress-data";
import {
  type CardId,
  createCardRenderMatrixConfig,
  type VariationId,
} from "@/tests/shared/card-render-matrix";
import { decodeHtmlEntities } from "@/tests/shared/html-entities";

interface TargetedCase {
  cardId: CardId;
  expectations: readonly string[];
  variation: VariationId;
}

const TARGETED_CASES: readonly TargetedCase[] = [
  {
    cardId: "animeSourceMaterialDistribution",
    expectations: ["Manga", "Light Novel"],
    variation: "default",
  },
  {
    cardId: "animeSourceMaterialDistribution",
    expectations: ["Manga", "Light Novel"],
    variation: "pie",
  },
  {
    cardId: "animeSourceMaterialDistribution",
    expectations: ["Manga", "Light Novel"],
    variation: "donut",
  },
  {
    cardId: "animeSourceMaterialDistribution",
    expectations: ["Manga", "Light Novel"],
    variation: "bar",
  },
  {
    cardId: "animeSeasonalPreference",
    expectations: ["Winter", "Spring"],
    variation: "default",
  },
  {
    cardId: "animeSeasonalPreference",
    expectations: ["Winter", "Spring"],
    variation: "pie",
  },
  {
    cardId: "animeSeasonalPreference",
    expectations: ["Winter", "Spring"],
    variation: "donut",
  },
  {
    cardId: "animeSeasonalPreference",
    expectations: ["Winter", "Spring"],
    variation: "bar",
  },
  {
    cardId: "animeSeasonalPreference",
    expectations: ["Winter", "Spring"],
    variation: "radar",
  },
  {
    cardId: "animeEpisodeLengthPreferences",
    expectations: ["Short (&lt;15 min)", "Standard (~25 min)"],
    variation: "default",
  },
  {
    cardId: "animeEpisodeLengthPreferences",
    expectations: ["Short (&lt;15 min)", "Long (&gt;30 min)"],
    variation: "pie",
  },
  {
    cardId: "animeEpisodeLengthPreferences",
    expectations: ["Short (&lt;15 min)", "Long (&gt;30 min)"],
    variation: "donut",
  },
  {
    cardId: "animeEpisodeLengthPreferences",
    expectations: ["Short (&lt;15 min)", "Long (&gt;30 min)"],
    variation: "bar",
  },
  {
    cardId: "animeGenreSynergy",
    expectations: [
      "Psychological Thriller + Supernatural Mystery",
      "Science Fiction Adventure + Character Study",
    ],
    variation: "default",
  },
  {
    cardId: "studioCollaboration",
    expectations: ["Bones + Studio Trigger", "MAPPA + Wit Studio"],
    variation: "default",
  },
];

export async function main(): Promise<void> {
  const { default: generateCardSvg } = await import("@/lib/card-generator");

  const failures: string[] = [];

  for (const matrixCase of TARGETED_CASES) {
    try {
      const svg = await generateCardSvg(
        createCardRenderMatrixConfig(matrixCase.cardId, matrixCase.variation),
        mockPretextStressUserRecord,
        matrixCase.variation,
        undefined,
        { animationsEnabled: false },
      );
      const decodedSvg = decodeHtmlEntities(svg);

      for (const expectedText of matrixCase.expectations) {
        if (!decodedSvg.includes(decodeHtmlEntities(expectedText))) {
          failures.push(
            `${matrixCase.cardId}:${matrixCase.variation} missing text: ${expectedText}`,
          );
        }
      }
    } catch (error) {
      failures.push(
        `${matrixCase.cardId}:${matrixCase.variation} threw during render: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`,
      );
    }
  }

  console.log(JSON.stringify({ failures }));
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
