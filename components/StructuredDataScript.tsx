import { headers } from "next/headers";

import type { StructuredDataEntry } from "@/lib/structured-data";
import { generateJsonLd } from "@/lib/structured-data";

interface StructuredDataScriptProps {
  data: StructuredDataEntry[];
}

/**
 * Renders a nonce-aware JSON-LD script for the current request.
 */
export async function StructuredDataScript({
  data,
}: Readonly<StructuredDataScriptProps>) {
  const nonce = (await headers()).get("x-nonce") || undefined;

  return (
    <script
      type="application/ld+json"
      nonce={nonce}
      dangerouslySetInnerHTML={generateJsonLd(data)}
    />
  );
}
