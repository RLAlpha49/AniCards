import { StructuredDataScript } from "@/components/StructuredDataScript";
import { generateMetadata as createMetadata, seoConfigs } from "@/lib/seo";
import { generateStructuredData } from "@/lib/structured-data";

import ContactPageClient from "./ContactPageClient";

export const metadata = createMetadata(seoConfigs.contact);

export default function ContactPage() {
  return (
    <>
      <StructuredDataScript data={generateStructuredData("contact")} />
      <ContactPageClient />
    </>
  );
}
