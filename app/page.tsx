import { BentoFeatures } from "@/components/home/BentoFeatures";
import { CardMarquee } from "@/components/home/CardMarquee";
import { HeroSection } from "@/components/home/HeroSection";
import { HomeCTA } from "@/components/home/HomeCTA";
import { ProcessSteps } from "@/components/home/ProcessSteps";
import { StatsRibbon } from "@/components/home/StatsRibbon";
import { MarketingBackdrop } from "@/components/marketing/MarketingBackdrop";
import { SectionReveal } from "@/components/marketing/SectionReveal";
import { StructuredDataScript } from "@/components/StructuredDataScript";
import { SHOW_LOADING_PREVIEW } from "@/lib/dev-loading-preview";
import {
  HOME_CARD_MARQUEE_ROWS,
  HOME_HERO_PREVIEW_CARDS,
} from "@/lib/home-page-preview-data";
import { getRequestNonce } from "@/lib/request-nonce";
import { generateMetadata as createMetadata, seoConfigs } from "@/lib/seo";
import { generateStructuredData } from "@/lib/structured-data";

import LoadingPreview from "./loading";

export const metadata = createMetadata(seoConfigs.home);

export default async function HomePage() {
  if (SHOW_LOADING_PREVIEW) {
    return <LoadingPreview />;
  }

  const nonce = await getRequestNonce();

  return (
    <>
      <StructuredDataScript
        data={generateStructuredData("home")}
        nonce={nonce}
      />
      <div className="relative min-h-screen">
        <MarketingBackdrop />
        <SectionReveal>
          <HeroSection cards={HOME_HERO_PREVIEW_CARDS} />
        </SectionReveal>
        <SectionReveal>
          <CardMarquee rows={HOME_CARD_MARQUEE_ROWS} />
        </SectionReveal>
        <SectionReveal>
          <BentoFeatures />
        </SectionReveal>
        <SectionReveal>
          <StatsRibbon />
        </SectionReveal>
        <SectionReveal>
          <ProcessSteps />
        </SectionReveal>
        <SectionReveal>
          <HomeCTA />
        </SectionReveal>
      </div>
    </>
  );
}
