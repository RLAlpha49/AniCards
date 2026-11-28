"use client";

import { PaperHero } from "@/components/primitives";
import { SearchLookupPanel } from "./SearchLookupPanel";

type SearchHeroProps = Readonly<{
  onLoadingChange: (loading: boolean) => void;
}>;

/** Figures under the hero copy, all true of this page. @source */
const FACTS = [
  { label: "Accepts", value: "Handle or ID" },
  { label: "Opens", value: "The saved set" },
  { label: "Generator", value: "Not needed" },
] as const;

/**
 * Hero for the search page.
 *
 * Two columns on a wide screen: what the lookup is for on the left, the field
 * that does it on the right. Stacked, the panel moves directly under the intro
 * so the field is the first control on a phone.
 *
 * @param props.onLoadingChange - Reports the pending lookup to the page.
 * @source
 */
export function SearchHero({ onLoadingChange }: SearchHeroProps) {
  return (
    <PaperHero
      centred
      asideLayout="centred"
      edition="Saved cards"
      editionNote="Open the set you already made"
      editionNoteDecorative
      kicker="For cards you already generated"
      title={
        <>
          Come back to
          <br />
          <em>your cards.</em>
        </>
      }
      lede={
        <>
          Every card the generator makes is saved against the AniList profile it
          came from. Enter a handle, or that profile&apos;s numeric ID, to open
          the set you already made and copy, download, or embed the cards.
          Nobody has to run the generator a second time.
        </>
      }
      facts={FACTS}
      aside={<SearchLookupPanel onLoadingChange={onLoadingChange} />}
    />
  );
}
