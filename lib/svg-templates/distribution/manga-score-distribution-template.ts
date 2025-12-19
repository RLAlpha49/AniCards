import { distributionTemplate } from "./shared";

type BaseInput = Parameters<typeof distributionTemplate>[0];
export type MangaScoreDistributionTemplateInput = Omit<
  BaseInput,
  "mediaType" | "kind"
>;

/** SVG template for the `mangaScoreDistribution` card type. */
export function mangaScoreDistributionTemplate(
  input: MangaScoreDistributionTemplateInput,
) {
  return distributionTemplate({ ...input, mediaType: "manga", kind: "score" });
}
