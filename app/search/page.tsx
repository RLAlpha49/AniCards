import { MarketingBackdrop } from "@/components/marketing/MarketingBackdrop";
import { SectionReveal } from "@/components/marketing/SectionReveal";
import { SearchCapabilities } from "@/components/search/SearchCapabilities";
import { SearchCTA } from "@/components/search/SearchCTA";
import { SearchJourney } from "@/components/search/SearchJourney";
import { StructuredDataScript } from "@/components/StructuredDataScript";
import { generateMetadata as createMetadata, seoConfigs } from "@/lib/seo";
import { generateStructuredData } from "@/lib/structured-data";

import SearchHeroShell from "./SearchHeroShell";

export const metadata = createMetadata(seoConfigs.search);

export default function UserSearchPage() {
  return (
    <>
      <StructuredDataScript data={generateStructuredData("search")} />
      <div className="relative min-h-screen">
        <MarketingBackdrop />
        <SearchHeroShell />

        <SectionReveal
          variant="lineExpand"
          style={{ originX: 0.5 }}
          className="gold-line-thick mx-auto max-w-[60%]"
        />

        <SectionReveal>
          <SearchJourney />
        </SectionReveal>

        <SectionReveal
          variant="lineExpand"
          style={{ originX: 0.5 }}
          className="gold-line mx-auto max-w-[40%]"
        />

        <SectionReveal>
          <SearchCapabilities />
        </SectionReveal>

        <SectionReveal>
          <SearchCTA />
        </SectionReveal>
      </div>
    </>
  );
}
