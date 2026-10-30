"use client";

import Link from "next/link";
import { ArrowRight } from "@/lib/icons";
import { SimpleGithubIcon } from "@/components/SimpleIcons";
import { useRevealInView } from "@/hooks/useRevealInView";
import { cn } from "@/lib/utils";
import {
  safeTrack,
  trackButtonClick,
  trackExternalLinkClick,
  trackNavigation,
} from "@/lib/utils/google-analytics";
import homeStyles from "@/components/home/home.module.css";
import type { Project } from "./catalogue";
import styles from "./projects.module.css";

type ProjectEntryProps = Readonly<{
  project: Project;
  /** Position in the list, starting at 1. */
  position: number;
  /** How many entries the page holds, for the running number. */
  total: number;
}>;

/**
 * One project, laid out as a catalogued entry.
 *
 * The margin holds the numeral, the platform, and the facts a visitor scans
 * first. The body answers, in order: what it is, when you would open it, what
 * it does step by step, and what it changes. The scope note sits directly above
 * the actions, so nobody follows a link without passing it.
 *
 * @param props.project - The project to render.
 * @param props.position - Position in the list, used for the running number.
 * @param props.total - Number of entries on the page.
 * @source
 */
export function ProjectEntry({ project, position, total }: ProjectEntryProps) {
  const { ref, phase } = useRevealInView<HTMLDivElement>();

  /** Reports the primary action and where it leads. @source */
  const reportPrimary = () => {
    safeTrack(() => trackButtonClick("project_open", project.id));
    if (project.primary.external) {
      safeTrack(() => trackExternalLinkClick(project.id, "projects_page"));
    } else {
      safeTrack(() => trackNavigation("generator", "projects_entry"));
    }
  };

  const actionLabel = (
    <>
      {project.primary.label}
      <ArrowRight className={styles.entryActionIcon} aria-hidden="true" />
    </>
  );

  return (
    <article id={project.id} className={styles.entry} tabIndex={-1}>
      <div
        ref={ref}
        data-reveal={phase}
        className={cn(styles.entryGrid, homeStyles.reveal)}
      >
        <div className={styles.entryMargin}>
          <div className={styles.entryMarginInner}>
            <p className={styles.entryRunning}>
              <span className={styles.entryNumeral} aria-hidden="true">
                {project.numeral}
              </span>
              <span className={styles.entryPosition}>
                {String(position).padStart(2, "0")} of{" "}
                {String(total).padStart(2, "0")}
              </span>
            </p>

            <p className={styles.entryPlatform}>{project.platform}</p>

            <dl className={styles.entryMeta}>
              {project.meta.map((fact) => (
                <div key={fact.label}>
                  <dt>{fact.label}</dt>
                  <dd>{fact.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        <div className={styles.entryBody}>
          <header className={styles.entryHead}>
            <h2 className={styles.entryName}>{project.name}</h2>
            <p className={styles.entryStandfirst}>{project.standfirst}</p>
          </header>

          <section className={styles.entryWhen}>
            <p className={styles.entryLabel}>Open it when</p>
            <p className={styles.entryWhenBody}>{project.useWhen}</p>
          </section>

          <section className={styles.entrySteps}>
            <p className={styles.entryLabel}>What it does</p>
            <ol className={styles.entryStepList}>
              {project.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </section>

          <p className={styles.entryScope}>
            <strong>{project.scope.label}</strong>
            {project.scope.body}
          </p>

          <div className={styles.entryActions}>
            {project.primary.external ? (
              <a
                href={project.primary.href}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.entryAction}
                onClick={reportPrimary}
              >
                {actionLabel}
              </a>
            ) : (
              <Link
                href={project.primary.href}
                className={styles.entryAction}
                onClick={reportPrimary}
              >
                {actionLabel}
              </Link>
            )}

            {/* The visible text stays first in the accessible name, and the
                project name follows for screen readers, so two links on one
                page never share a name. */}
            <a
              href={project.source}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.entrySource}
              onClick={() =>
                safeTrack(() =>
                  trackExternalLinkClick(project.id, "projects_source"),
                )
              }
            >
              <span aria-hidden="true" className={styles.entrySourceIcon}>
                <SimpleGithubIcon size={15} />
              </span>
              View on GitHub
              <span className="sr-only"> for {project.name}</span>
            </a>
          </div>
        </div>
      </div>
    </article>
  );
}
