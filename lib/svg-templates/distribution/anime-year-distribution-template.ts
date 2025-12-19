import { distributionTemplate } from "./shared";

type BaseInput = Parameters<typeof distributionTemplate>[0];
export type AnimeYearDistributionTemplateInput = Omit<
  BaseInput,
  "mediaType" | "kind"
>;

/** SVG template for the `animeYearDistribution` card type. */
export function animeYearDistributionTemplate(
  input: AnimeYearDistributionTemplateInput,
) {
  return distributionTemplate({ ...input, mediaType: "anime", kind: "year" });
}
