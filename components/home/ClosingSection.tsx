"use client";

import { ArrowDown, ArrowRight } from "@/lib/icons";
import { PageCta } from "@/components/PageCta";

type ClosingSectionProps = Readonly<{
  onGetStarted: () => void;
  onSeeExamples: () => void;
}>;

/**
 * Closing call to action for the home page.
 *
 * The shared block carries the frame. This page supplies the words and keeps
 * its own second action, which scrolls back to the card gallery.
 *
 * @param props.onGetStarted - Opens the stat card generator.
 * @param props.onSeeExamples - Scrolls back to the card gallery.
 * @source
 */
export function ClosingSection({
  onGetStarted,
  onSeeExamples,
}: ClosingSectionProps) {
  return (
    <PageCta
      seal="記"
      title={
        <>
          Make your <em>first card</em>
        </>
      }
      primary={{
        label: "Open the generator",
        onClick: onGetStarted,
        icon: <ArrowRight />,
      }}
      secondary={{
        label: "View examples",
        onClick: onSeeExamples,
        icon: <ArrowDown />,
        iconRotate: 180,
      }}
      backToTopLabel="home_back_to_top"
      fine="No sign-in · Public data only · SVG, PNG, and WebP"
    >
      Enter your AniList username, choose a colour preset, and pick the card
      types you want. The generator walks you through it in four steps.
    </PageCta>
  );
}
