import { StructuredDataScript } from "@/components/StructuredDataScript";
import { getRequestNonce } from "@/lib/request-nonce";
import { generateMetadata as createMetadata, seoConfigs } from "@/lib/seo";
import { generateStructuredData } from "@/lib/structured-data";

import { getExamplesCatalog } from "./examples-catalog";
import ExamplesPageClient from "./ExamplesPageClient";

export const metadata = createMetadata(seoConfigs.examples);

export default async function ExamplesPage() {
  const nonce = await getRequestNonce();
  const catalog = getExamplesCatalog();

  return (
    <>
      <StructuredDataScript
        data={generateStructuredData("examples")}
        nonce={nonce}
      />
      <ExamplesPageClient catalog={catalog} />
    </>
  );
}
