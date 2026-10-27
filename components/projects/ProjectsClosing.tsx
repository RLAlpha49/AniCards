"use client";

import { ArrowRight } from "@/lib/icons";
import { SimpleGithubIcon } from "@/components/SimpleIcons";
import { PageCta } from "@/components/PageCta";
import {
  safeTrack,
  trackExternalLinkClick,
  trackNavigation,
} from "@/lib/utils/google-analytics";

/**
 * Closing block for the projects page.
 *
 * Offers the two things a visitor can still want at this point: the generator,
 * which is what this site is for, and the GitHub profile, for everything else.
 * @source
 */
export function ProjectsClosing() {
  return (
    <PageCta
      seal="庵"
      title={
        <>
          Your stats are what <em>this site</em> makes.
        </>
      }
      primary={{
        label: "Open the generator",
        href: "/generator",
        icon: <ArrowRight />,
        onClick: () =>
          safeTrack(() => trackNavigation("generator", "projects_closing")),
      }}
      secondary={{
        label: "Visit my GitHub",
        hrefExternal: "https://github.com/RLAlpha49",
        icon: <SimpleGithubIcon size={16} />,
        onClick: () =>
          safeTrack(() =>
            trackExternalLinkClick("github_profile", "projects_closing"),
          ),
      }}
      backToTopLabel="projects_back_to_top"
      fine="Free · MIT licensed · No account on this site"
    >
      The two projects above change your AniList lists. AniCards reads the same
      account and turns it into cards. Start there, or browse the rest of the
      code on GitHub.
    </PageCta>
  );
}
