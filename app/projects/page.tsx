import { MarketingBackdrop } from "@/components/marketing/MarketingBackdrop";
import { SectionReveal } from "@/components/marketing/SectionReveal";
import { FeaturedProject } from "@/components/projects/FeaturedProject";
import { ProjectCollection } from "@/components/projects/ProjectCollection";
import { ProjectEthos } from "@/components/projects/ProjectEthos";
import { ProjectsCTA } from "@/components/projects/ProjectsCTA";
import { ProjectsHeroSection } from "@/components/projects/ProjectsHeroSection";
import { StructuredDataScript } from "@/components/StructuredDataScript";
import { SHOW_LOADING_PREVIEW } from "@/lib/dev-loading-preview";
import { getRequestNonce } from "@/lib/request-nonce";
import { generateMetadata as createMetadata, seoConfigs } from "@/lib/seo";
import { generateStructuredData } from "@/lib/structured-data";

import LoadingPreview from "./loading";

export const metadata = createMetadata(seoConfigs.projects);

export default async function ProjectsPage() {
  if (SHOW_LOADING_PREVIEW) {
    return <LoadingPreview />;
  }

  const nonce = await getRequestNonce();

  return (
    <>
      <StructuredDataScript
        data={generateStructuredData("projects")}
        nonce={nonce}
      />
      <div className="relative min-h-screen">
        <MarketingBackdrop />
        <ProjectsHeroSection />
        <SectionReveal>
          <FeaturedProject />
        </SectionReveal>
        <SectionReveal>
          <ProjectCollection />
        </SectionReveal>
        <SectionReveal>
          <ProjectEthos />
        </SectionReveal>
        <SectionReveal>
          <ProjectsCTA />
        </SectionReveal>
      </div>
    </>
  );
}
