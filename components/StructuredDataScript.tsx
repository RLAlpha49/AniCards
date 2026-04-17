import { getRequestNonce } from "@/lib/request-nonce";
import {
  generateJsonLd,
  generateStructuredData,
  type StructuredDataEntry,
  type StructuredDataOverrides,
  type StructuredDataPageKey,
} from "@/lib/structured-data";

type StructuredDataScriptProps =
  | {
      data: StructuredDataEntry[];
      nonce?: string;
      page?: never;
      overrides?: never;
    }
  | {
      data?: never;
      nonce?: string;
      page: StructuredDataPageKey;
      overrides?: StructuredDataOverrides;
    };

/**
 * Renders a nonce-aware JSON-LD script for the current request.
 */
export async function StructuredDataScript(
  props: Readonly<StructuredDataScriptProps>,
) {
  const nonce = props.nonce ?? (await getRequestNonce());
  const data =
    props.data ?? generateStructuredData(props.page, props.overrides);

  return (
    <script
      type="application/ld+json"
      suppressHydrationWarning
      nonce={nonce}
      dangerouslySetInnerHTML={generateJsonLd(data)}
    />
  );
}
