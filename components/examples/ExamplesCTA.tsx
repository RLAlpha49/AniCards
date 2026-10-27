"use client";

import { ArrowRight } from "@/lib/icons";
import { PageCta } from "@/components/PageCta";

type ExamplesCTAProps = Readonly<{
  onOpenGenerator: () => void;
  cardTypeCount: number;
}>;

/**
 * Closing block for the examples page.
 *
 * Names the card type count, then sends the visitor to the generator.
 *
 * @param props.onOpenGenerator - Opens the stat card generator.
 * @param props.cardTypeCount - Number of card types shown on the page.
 * @source
 */
export function ExamplesCTA({
  onOpenGenerator,
  cardTypeCount,
}: ExamplesCTAProps) {
  return (
    <PageCta
      seal="記"
      title={
        <>
          Make these <em>your cards</em>
        </>
      }
      primary={{
        label: "Create your cards",
        onClick: onOpenGenerator,
        icon: <ArrowRight />,
      }}
      backToTopLabel="examples_back_to_top"
      fine={`No sign-in · Public data only · ${cardTypeCount} card types`}
    >
      Every card on this page comes from the same generator. Enter your AniList
      username, pick a colour preset, choose your card types, and download the
      files.
    </PageCta>
  );
}
