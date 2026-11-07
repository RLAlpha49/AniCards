"use client";

import { ArrowRight, ExternalLink, Mail } from "@/lib/icons";
import {
  SimpleAniListIcon,
  SimpleDiscordIcon,
  SimpleGithubIcon,
} from "@/components/SimpleIcons";
import { useRevealInView } from "@/hooks/useRevealInView";
import { cn } from "@/lib/utils";
import {
  safeTrack,
  trackExternalLinkClick,
} from "@/lib/utils/google-analytics";
import homeStyles from "@/components/home/home.module.css";
import { DIRECTORY_CHANNELS, type DirectoryChannel } from "./channels";
import styles from "./contact.module.css";

/** Brand marks, keyed by the channel's brand field. @source */
const BRAND_ICONS = {
  github: SimpleGithubIcon,
  discord: SimpleDiscordIcon,
  anilist: SimpleAniListIcon,
  email: Mail,
} as const;

type BrandMarkProps = Readonly<{
  brand: DirectoryChannel["brand"];
}>;

/**
 * Draws a channel's brand mark at directory size.
 *
 * The library icons carry their own accessible labels, so the mark is wrapped
 * in a hidden span. Without it a screen reader would read "GitHub, GitHub" for
 * each row, because the name is already visible beside the mark.
 *
 * @param props.brand - Which brand mark to draw.
 * @source
 */
function BrandMark({ brand }: BrandMarkProps) {
  const BrandIcon = BRAND_ICONS[brand];

  return (
    <span aria-hidden="true">
      <BrandIcon size={16} />
    </span>
  );
}

/**
 * Open directory of every channel, for visitors who already know where they are
 * going.
 *
 * The desk above routes a message to the right channel. This section does the
 * opposite job: it shows all four addresses at once, so nobody has to answer a
 * question to reach an inbox they already picked.
 * @source
 */
export function ContactDirectory() {
  const { ref, phase } = useRevealInView<HTMLDivElement>();

  return (
    <section className={styles.directory}>
      <div className={styles.sheet}>
        <header className={styles.dirHead}>
          <h2 className={styles.dirHeadTitle}>
            All four channels, with their addresses
          </h2>
        </header>

        <div
          ref={ref}
          data-reveal={phase}
          className={cn(styles.dirGrid, homeStyles.reveal)}
        >
          {DIRECTORY_CHANNELS.map((channel) => (
            <article key={channel.id} className={styles.dirCard}>
              <div className={styles.dirTop}>
                <span className={styles.dirIcon}>
                  <BrandMark brand={channel.brand} />
                </span>
                <h3 className={styles.dirName}>{channel.name}</h3>
              </div>

              <a
                href={channel.href}
                target={channel.external ? "_blank" : undefined}
                rel={channel.external ? "noopener noreferrer" : undefined}
                onClick={() =>
                  safeTrack(() =>
                    trackExternalLinkClick(channel.id, "contact_directory"),
                  )
                }
                className={styles.dirAddress}
              >
                {channel.address}
                {channel.external ? (
                  <ExternalLink
                    className={styles.dirAddressIcon}
                    aria-hidden="true"
                  />
                ) : (
                  <ArrowRight
                    className={styles.dirAddressIcon}
                    aria-hidden="true"
                  />
                )}
              </a>
            </article>
          ))}
        </div>

        <p className={styles.dirFoot}>
          Card bugs and card ideas belong in the issue list, because an issue
          keeps the link, the screenshot, and the fix together. Before filing
          one, check the{" "}
          <a href="/examples" className={styles.inlineLink}>
            examples page
          </a>{" "}
          to see whether the card already does what you want. When you are
          ready,{" "}
          <a
            href="https://github.com/RLAlpha49/AniCards/issues"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() =>
              safeTrack(() =>
                trackExternalLinkClick("github_issues", "contact_directory"),
              )
            }
            className={styles.inlineLink}
          >
            open an issue on GitHub
          </a>
          .
        </p>
      </div>
    </section>
  );
}
