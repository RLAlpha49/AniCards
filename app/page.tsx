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
  buildExamplesCollectionPath,
  buildExamplesGalleryPath,
} from "@/lib/examples-collections";
import {
  HOME_CARD_MARQUEE_ROWS,
  HOME_HERO_PREVIEW_CARDS,
} from "@/lib/home-page-preview-data";
import { getRequestNonce } from "@/lib/request-nonce";
import { generateMetadata as createMetadata, seoConfigs } from "@/lib/seo";
import { generateStructuredData } from "@/lib/structured-data";

import {
  getExampleCatalogRouteLink,
  getExamplesCatalog,
} from "./examples/examples-catalog";
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

  const resolveExampleHref = (cardTypeId: string, fallbackHref: string) =>
    getExampleCatalogRouteLink(cardTypeId)?.href ?? fallbackHref;
  const totalCardTypes = getExamplesCatalog().totalCardTypes;
  const bentoFeatureLinks = [
    {
      href: resolveExampleHref(
        "animeStats",
        buildExamplesCollectionPath("core-stats"),
      ),
      label: "Open live stats examples",
    },
    {
      href: resolveExampleHref(
        "animeGenres",
        buildExamplesCollectionPath("anime-deep-dive"),
      ),
      label: "Open live genre examples",
    },
    {
      href: buildExamplesGalleryPath(),
      label: "Browse live gallery",
    },
    {
      href: resolveExampleHref(
        "mangaStats",
        buildExamplesCollectionPath("core-stats"),
      ),
      label: "Open live manga examples",
    },
    {
      href: resolveExampleHref(
        "animeVoiceActors",
        buildExamplesCollectionPath("anime-deep-dive"),
      ),
      label: "Open voice actor examples",
    },
    {
      href: resolveExampleHref(
        "animeStudios",
        buildExamplesCollectionPath("anime-deep-dive"),
      ),
      label: "Open studio examples",
    },
    {
      href: buildExamplesGalleryPath(),
      label: "Browse share-ready cards",
    },
    {
      href: buildExamplesCollectionPath("core-stats"),
      label: "See public-profile examples",
    },
  ] as const;
  const processStepLinks = [
    {
      href: resolveExampleHref(
        "profileOverview",
        buildExamplesCollectionPath("core-stats"),
      ),
      label: "Open a profile example",
    },
    {
      href: buildExamplesGalleryPath(),
      label: "Browse the live catalog",
    },
    {
      href: resolveExampleHref(
        "favoritesSummary",
        buildExamplesCollectionPath("library-progress"),
      ),
      label: "Start from a live example",
    },
  ] as const;

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
        <BentoFeatures featureLinks={bentoFeatureLinks} />
        <StatsRibbon totalCardTypes={totalCardTypes} />
        <ProcessSteps
          totalCardTypes={totalCardTypes}
          stepLinks={processStepLinks}
        />
        <HomeCTA />
      </div>
    </>
  );
}
