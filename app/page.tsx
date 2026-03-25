import { BentoFeatures } from "@/components/home/BentoFeatures";
import { CardMarquee } from "@/components/home/CardMarquee";
import { HeroSection } from "@/components/home/HeroSection";
import { HomeCTA } from "@/components/home/HomeCTA";
import { ProcessSteps } from "@/components/home/ProcessSteps";
import { StatsRibbon } from "@/components/home/StatsRibbon";
import { MarketingBackdrop } from "@/components/marketing/MarketingBackdrop";
import { SectionReveal } from "@/components/marketing/SectionReveal";
import { StructuredDataScript } from "@/components/StructuredDataScript";
import { generateMetadata as createMetadata, seoConfigs } from "@/lib/seo";
import { generateStructuredData } from "@/lib/structured-data";

export const metadata = createMetadata(seoConfigs.home);

export default function HomePage() {
  return (
    <>
      <StructuredDataScript data={generateStructuredData("home")} />
      <div className="relative min-h-screen">
        <MarketingBackdrop />
        <SectionReveal>
          <HeroSection />
        </SectionReveal>
        <SectionReveal>
          <CardMarquee />
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
