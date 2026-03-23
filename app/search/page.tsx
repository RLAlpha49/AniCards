import { StructuredDataScript } from "@/components/StructuredDataScript";
import { generateMetadata as createMetadata, seoConfigs } from "@/lib/seo";
import { generateStructuredData } from "@/lib/structured-data";

import SearchPageClient from "./SearchPageClient";

export const metadata = createMetadata(seoConfigs.search);

export default function UserSearchPage() {
  return (
    <>
      <StructuredDataScript data={generateStructuredData("search")} />
      <SearchPageClient />
    </>
  );
}
