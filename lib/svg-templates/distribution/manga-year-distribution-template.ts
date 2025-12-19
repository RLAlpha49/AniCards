import { distributionTemplate } from "./shared";

type BaseInput = Parameters<typeof distributionTemplate>[0];
export type MangaYearDistributionTemplateInput = Omit<
  BaseInput,
  "mediaType" | "kind"
>;

/** SVG template for the `mangaYearDistribution` card type. */
export function mangaYearDistributionTemplate(
  input: MangaYearDistributionTemplateInput,
) {
  return distributionTemplate({ ...input, mediaType: "manga", kind: "year" });
}
