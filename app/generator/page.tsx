import type { Metadata } from "next";
import { generateMetadata as createMetadata, seoConfigs } from "@/lib/seo";
import { GeneratorShell } from "@/components/generator/GeneratorShell";

/** Static metadata for the generator route. @source */
export const metadata: Metadata = createMetadata(seoConfigs.generator);

/**
 * The card generator.
 *
 * Lives at its own route so a finished card has an address to come back to,
 * and so the generator has the full page height rather than a scrolling dialog.
 * @source
 */
export default function GeneratorPage() {
  return <GeneratorShell />;
}
