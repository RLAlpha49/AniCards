import { StructuredDataScript } from "@/components/StructuredDataScript";
import { generateMetadata as createMetadata, seoConfigs } from "@/lib/seo";
import { generateStructuredData } from "@/lib/structured-data";

import HomePageClient from "./HomePageClient";

export const metadata = createMetadata(seoConfigs.home);

export default function HomePage() {
  return (
    <>
      <StructuredDataScript data={generateStructuredData("home")} />
      <HomePageClient />
    </>
  );
}
