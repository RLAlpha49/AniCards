import { distributionTemplate } from "./shared";

type BaseInput = Parameters<typeof distributionTemplate>[0];
export type AnimeScoreDistributionTemplateInput = Omit<
  BaseInput,
  "mediaType" | "kind"
>;

/** SVG template for the `animeScoreDistribution` card type. */
export function animeScoreDistributionTemplate(
  input: AnimeScoreDistributionTemplateInput,
) {
  return distributionTemplate({ ...input, mediaType: "anime", kind: "score" });
}
