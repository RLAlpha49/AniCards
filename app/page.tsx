import { Suspense } from "react";

import { BentoFeatures } from "@/components/home/BentoFeatures";
import { CardMarquee } from "@/components/home/CardMarquee";
import { HeroSection } from "@/components/home/HeroSection";
import { HomeCTA } from "@/components/home/HomeCTA";
import { ProcessSteps } from "@/components/home/ProcessSteps";
import { StatsRibbon } from "@/components/home/StatsRibbon";
import { MarketingBackdrop } from "@/components/marketing/MarketingBackdrop";
import { StructuredDataScript } from "@/components/StructuredDataScript";
import { SHOW_LOADING_PREVIEW } from "@/lib/dev-loading-preview";
import {
  HOME_CARD_MARQUEE_ROWS,
  HOME_HERO_PREVIEW_CARDS,
} from "@/lib/home-page-preview-data";
import { getRequestNonce } from "@/lib/request-nonce";
import { generateMetadata as createMetadata, seoConfigs } from "@/lib/seo";
import { generateStructuredData } from "@/lib/structured-data";

import { getExamplesCatalog } from "./examples/examples-catalog";
import LoadingPreview from "./loading";

export const metadata = createMetadata(seoConfigs.home);

async function HomeStructuredData() {
  const nonce = await getRequestNonce();

  return (
    <StructuredDataScript data={generateStructuredData("home")} nonce={nonce} />
  );
}

export default function HomePage() {
  if (SHOW_LOADING_PREVIEW) {
    return <LoadingPreview />;
  }

  const totalCardTypes = getExamplesCatalog().totalCardTypes;

  return (
    <>
      <Suspense fallback={null}>
        <HomeStructuredData />
      </Suspense>
      <div className="relative min-h-shell-viewport">
        <MarketingBackdrop />
        <HeroSection
          cards={HOME_HERO_PREVIEW_CARDS}
          totalCardTypes={totalCardTypes}
        />
        <CardMarquee rows={HOME_CARD_MARQUEE_ROWS} />
        <BentoFeatures />
        <StatsRibbon totalCardTypes={totalCardTypes} />
        <ProcessSteps totalCardTypes={totalCardTypes} />
        <HomeCTA />
      </div>
    </>
  );
}
