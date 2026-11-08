"use client";

import { useRouter } from "next/navigation";
import { ArrowRight } from "@/lib/icons";
import { PageCta } from "@/components/PageCta";
import {
  safeTrack,
  trackButtonClick,
  trackNavigation,
} from "@/lib/utils/google-analytics";

/**
 * Closing block for the contact page.
 *
 * Most people who reach this page are looking for something the generator
 * already does, so the last action sends them there instead of asking for
 * another message.
 * @source
 */
export function ContactClosing() {
  const router = useRouter();

  const openGenerator = () => {
    safeTrack(() => trackButtonClick("open_generator", "contact_closing"));
    safeTrack(() => trackNavigation("generator", "contact_closing"));
    router.push("/generator");
  };

  return (
    <PageCta
      seal="便"
      title={
        <>
          Try the <em>generator</em> first
        </>
      }
      primary={{
        label: "Open the generator",
        onClick: openGenerator,
        icon: <ArrowRight />,
      }}
      backToTopLabel="contact_back_to_top"
      fine="No sign-in · Public data only · One person reads every message"
    >
      Most questions about a card answer themselves once you see it rendered
      with your own stats. Enter a username, pick a palette, and look before you
      write in.
    </PageCta>
  );
}
