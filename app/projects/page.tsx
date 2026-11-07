"use client";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PaperSurface } from "@/components/PaperSurface";
import { SeigaihaDivider } from "@/components/SeigaihaDivider";
import { usePageSEO } from "@/hooks/usePageSEO";
import { ProjectsHero } from "@/components/projects/ProjectsHero";
import { ProjectsLedger } from "@/components/projects/ProjectsLedger";
import { ProjectEntry } from "@/components/projects/ProjectEntry";
import { ProjectsNotes } from "@/components/projects/ProjectsNotes";
import { ProjectsClosing } from "@/components/projects/ProjectsClosing";
import { PROJECTS } from "@/components/projects/catalogue";
import homeStyles from "@/components/home/home.module.css";
import styles from "@/components/projects/projects.module.css";

/**
 * The projects page.
 *
 * AniCards draws your stats. The two tools here change your lists. The page is
 * built around that difference: the hero ends in a routing list of the
 * situations a visitor arrives with, and each entry below answers what the tool
 * is, when to open it, what it does, and what it writes before offering a link.
 *
 * The scope note on each entry is the point of the layout. Anyone following a
 * link that leads to a bulk write to their AniList account has read, on the same
 * screen, exactly which fields the tool touches.
 * @source
 */
export default function ProjectsPage() {
  usePageSEO("projects");

  return (
    <ErrorBoundary>
      <PaperSurface>
        <ProjectsHero />

        <ProjectsLedger />

        <SeigaihaDivider className={homeStyles.wave} />

        <div className={styles.entries}>
          <div className={styles.sheet}>
            {PROJECTS.map((project, index) => (
              <ProjectEntry
                key={project.id}
                project={project}
                position={index + 1}
                total={PROJECTS.length}
              />
            ))}

            <ProjectsNotes />
          </div>
        </div>

        <ProjectsClosing />
      </PaperSurface>
    </ErrorBoundary>
  );
}
