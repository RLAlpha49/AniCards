import { StructuredDataScript } from "@/components/StructuredDataScript";
import { generateMetadata as createMetadata, seoConfigs } from "@/lib/seo";
import { generateStructuredData } from "@/lib/structured-data";

import { getExamplesCatalog } from "./examples-catalog";
import ExamplesPageClient from "./ExamplesPageClient";

export const metadata = createMetadata(seoConfigs.examples);

export default function ExamplesPage() {
  const catalog = getExamplesCatalog();

  return (
    <>
      <StructuredDataScript data={generateStructuredData("examples")} />
      <ExamplesPageClient catalog={catalog} />
    </>
  );
}
