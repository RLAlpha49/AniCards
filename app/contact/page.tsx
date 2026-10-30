"use client";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PaperSurface } from "@/components/PaperSurface";
import { SeigaihaDivider } from "@/components/SeigaihaDivider";
import { usePageSEO } from "@/hooks/usePageSEO";
import { ContactHero } from "@/components/contact/ContactHero";
import { ContactDesk } from "@/components/contact/ContactDesk";
import { ContactDirectory } from "@/components/contact/ContactDirectory";
import { ContactClosing } from "@/components/contact/ContactClosing";
import homeStyles from "@/components/home/home.module.css";
import styles from "@/components/contact/contact.module.css";

/**
 * The contact page.
 *
 * Routes a message instead of listing links. The visitor says what the message
 * is about, and the page names the channel that handles it, explains why that
 * channel, and lists what to include. The directory below stays open for anyone
 * who already knows where they are going.
 * @source
 */
export default function ContactPage() {
  usePageSEO("contact");

  return (
    <ErrorBoundary>
      <PaperSurface>
        <ContactHero />

        <SeigaihaDivider className={homeStyles.wave} />

        <section className={styles.deskSection}>
          <div className={styles.sheet}>
            <ContactDesk />
          </div>
        </section>

        <ContactDirectory />

        <ContactClosing />
      </PaperSurface>
    </ErrorBoundary>
  );
}
