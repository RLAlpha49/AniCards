import { ContactChannels } from "@/components/contact/ContactChannels";
import { ContactCTA } from "@/components/contact/ContactCTA";
import { ContactHeroSection } from "@/components/contact/ContactHeroSection";
import { ContactReasons } from "@/components/contact/ContactReasons";
import { MarketingBackdrop } from "@/components/marketing/MarketingBackdrop";
import { SectionReveal } from "@/components/marketing/SectionReveal";
import { StructuredDataScript } from "@/components/StructuredDataScript";
import { SHOW_LOADING_PREVIEW } from "@/lib/dev-loading-preview";
import { getRequestNonce } from "@/lib/request-nonce";
import { generateMetadata as createMetadata, seoConfigs } from "@/lib/seo";
import { generateStructuredData } from "@/lib/structured-data";

import LoadingPreview from "./loading";

export const metadata = createMetadata(seoConfigs.contact);

export default async function ContactPage() {
  if (SHOW_LOADING_PREVIEW) {
    return <LoadingPreview />;
  }

  const nonce = await getRequestNonce();

  return (
    <>
      <StructuredDataScript
        data={generateStructuredData("contact")}
        nonce={nonce}
      />
      <div className="relative min-h-screen">
        <MarketingBackdrop />

        <SectionReveal>
          <ContactHeroSection />
        </SectionReveal>

        <SectionReveal
          variant="lineExpand"
          className="
            mx-auto h-px max-w-[60%] origin-center bg-linear-to-r from-transparent
            via-[hsl(var(--gold)/0.2)] to-transparent
          "
        />

        <SectionReveal>
          <ContactChannels />
        </SectionReveal>

        <SectionReveal>
          <ContactReasons />
        </SectionReveal>

        <SectionReveal>
          <ContactCTA />
        </SectionReveal>
      </div>
    </>
  );
}
