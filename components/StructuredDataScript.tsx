import type { StructuredDataEntry } from "@/lib/structured-data";
import { generateJsonLd } from "@/lib/structured-data";

interface StructuredDataScriptProps {
  data: StructuredDataEntry[];
  nonce: string | undefined;
}

/**
 * Renders a nonce-aware JSON-LD script for the current request.
 */
export function StructuredDataScript({
  data,
  nonce,
}: Readonly<StructuredDataScriptProps>) {
  return (
    <script
      type="application/ld+json"
      suppressHydrationWarning
      nonce={nonce}
      dangerouslySetInnerHTML={generateJsonLd(data)}
    />
  );
}
