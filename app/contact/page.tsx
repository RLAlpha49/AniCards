import { ContactChannels } from "@/components/contact/ContactChannels";
import { ContactCTA } from "@/components/contact/ContactCTA";
import { ContactHeroSection } from "@/components/contact/ContactHeroSection";
import { ContactReasons } from "@/components/contact/ContactReasons";
import { MarketingBackdrop } from "@/components/marketing/MarketingBackdrop";
import { SectionReveal } from "@/components/marketing/SectionReveal";
import { StructuredDataScript } from "@/components/StructuredDataScript";
import { getRequestNonce } from "@/lib/request-nonce";
import { generateMetadata as createMetadata, seoConfigs } from "@/lib/seo";
import { generateStructuredData } from "@/lib/structured-data";

export const metadata = createMetadata(seoConfigs.contact);

export default async function ContactPage() {
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
