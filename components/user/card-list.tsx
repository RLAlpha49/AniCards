"use client";

import { Card } from "@/components/user/card";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { copyToClipboard } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check } from "lucide-react";
import { Link } from "lucide-react";

interface CardType {
  type: string;
  svgUrl: string;
  rawType: string;
}

interface CardListProps {
  cardTypes: CardType[];
}

// Component for displaying a grid of cards with copyable SVG links
export function CardList({ cardTypes }: CardListProps) {
  // Track which type of link was copied last (svg/anilist)
  const [copied, setCopied] = useState<string | null>(null);

  // Generate different link formats for copy functionality
  const svgLinks = cardTypes.map((card) => card.svgUrl);
  const anilistBioLinks = cardTypes.map((card) => `img150(${card.svgUrl})`);

  // Extract userId from the first card's svgUrl
  const userId = new URL(svgLinks[0]).searchParams.get("userId");
  const statsLink = `[<h1>Stats</h1>](https://anicards.alpha49.com/user?userId=${userId})`;

  // Handle bulk copy operations for different link formats
  const handleCopyLinks = async (type: "svg" | "anilist") => {
    const links = type === "svg" ? svgLinks : [statsLink, ...anilistBioLinks];
    await copyToClipboard(links.join("\n")); // Join array with newlines
    setCopied(type);
    setTimeout(() => setCopied(null), 2000); // Reset copied state after 2s
  };

  return (
    <div className="flex flex-col items-center space-y-4">
      {/* Popover for bulk copy operations */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline">
            <Link className="mr-2 h-4 w-4" /> Copy All Links
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80">
          <div className="space-y-2">
            {/* SVG links copy section */}
            <div>
              <p className="text-sm font-medium">SVG Link</p>
              <div className="mt-1 flex">
                <input
                  className="flex-grow rounded-l-md border px-3 py-2 text-sm"
                  value={svgLinks.join("\n")}
                  readOnly
                />
                <Button
                  onClick={() => handleCopyLinks("svg")}
                  className="rounded-l-none border px-3 py-2 text-sm"
                  style={{ height: "auto" }}
                >
                  {copied === "svg" ? <Check className="h-4 w-4" /> : "Copy"}
                </Button>
              </div>
            </div>

            {/* Anilist bio format copy section */}
            <div>
              <p className="text-sm font-medium">Anilist Bio Example</p>
              <div className="mt-1 flex">
                <input
                  className="flex-grow rounded-l-md border px-3 py-2 text-sm"
                  value={[...anilistBioLinks, statsLink].join("\n")}
                  readOnly
                />
                <Button
                  onClick={() => handleCopyLinks("anilist")}
                  className="rounded-l-none border px-3 py-2 text-sm"
                  style={{ height: "auto" }}
                >
                  {copied === "anilist" ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    "Copy"
                  )}
                </Button>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Grid of card components */}
      <div className="flex flex-wrap justify-center gap-6">
        {cardTypes.map((card) => (
          <Card key={card.rawType} {...card} />
        ))}
      </div>
    </div>
  );
}
