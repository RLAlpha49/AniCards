import { StructuredDataScript } from "@/components/StructuredDataScript";
import { generateMetadata as createMetadata, seoConfigs } from "@/lib/seo";
import { generateStructuredData } from "@/lib/structured-data";

import ProjectsPageClient from "./ProjectsPageClient";

export const metadata = createMetadata(seoConfigs.projects);

export default function ProjectsPage() {
  return (
    <>
      <StructuredDataScript data={generateStructuredData("projects")} />
      <ProjectsPageClient />
    </>
  );
}
