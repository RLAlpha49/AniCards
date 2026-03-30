import { StructuredDataScript } from "@/components/StructuredDataScript";
import { SHOW_LOADING_PREVIEW } from "@/lib/dev-loading-preview";
import { getRequestNonce } from "@/lib/request-nonce";
import { generateMetadata as createMetadata, seoConfigs } from "@/lib/seo";
import { generateStructuredData } from "@/lib/structured-data";

import { getExamplesCatalog } from "./examples-catalog";
import ExamplesPageClient from "./ExamplesPageClient";
import LoadingPreview from "./loading";

export const metadata = createMetadata(seoConfigs.examples);

export default async function ExamplesPage() {
  if (SHOW_LOADING_PREVIEW) {
    return <LoadingPreview />;
  }

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
