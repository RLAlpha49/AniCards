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
import { Check, Link } from "lucide-react";
import { motion } from "framer-motion";

interface CardType {
  type: string;
  svgUrl: string;
  rawType: string;
}

interface CardListProps {
  cardTypes: CardType[];
}

// Component for displaying a grid of cards with copyable SVG links
export function CardList({ cardTypes }: Readonly<CardListProps>) {
  // Track which type of link was copied last (svg/anilist)
  const [copied, setCopied] = useState<string | null>(null);

  // Convert relative URLs to absolute URLs if needed
  const getAbsoluteUrl = (url: string) => {
    if (!globalThis.window) return url;
    if (url.startsWith("http")) return url;
    return `${globalThis.window.location.origin}${url}`;
  };

  // Generate different link formats for copy functionality
  const svgLinks = cardTypes.map((card) => getAbsoluteUrl(card.svgUrl));
  const anilistBioLinks = cardTypes.map(
    (card) => `img150(${getAbsoluteUrl(card.svgUrl)})`,
  );

  // Extract userId from the first card's svgUrl using URL/URLSearchParams
  const firstCardUrl = cardTypes[0]?.svgUrl;
  let userId: string | null = null;

  if (firstCardUrl) {
    try {
      const origin = globalThis.window?.location.origin ?? "http://localhost";
      const url = new URL(firstCardUrl, origin);
      userId = url.searchParams.get("userId");
    } catch (error) {
      // Gracefully handle malformed URLs, but log for debugging
      console.error("Failed to extract userId from card URL:", error);
      userId = null;
    }
  }

  const statsLink = userId
    ? `[<h1>Stats</h1>](https://anicards.alpha49.com/user?userId=${userId})`
    : "";

  // Handle bulk copy operations for different link formats
  const handleCopyLinks = async (type: "svg" | "anilist") => {
    const links = type === "svg" ? svgLinks : [statsLink, ...anilistBioLinks];
    await copyToClipboard(links.join("\n")); // Join array with newlines
    setCopied(type);
    setTimeout(() => setCopied(null), 2000); // Reset copied state after 2s
  };

  return (
    <div className="mx-auto w-full max-w-7xl">
      {/* Header Section with Copy Links */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8 flex justify-center"
      >
        <div className="rounded-2xl border border-white/20 bg-white/10 p-6 backdrop-blur-sm dark:border-gray-700/30 dark:bg-gray-800/20">
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 p-2">
              <Link className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Export Your Cards
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Copy links in different formats for sharing
              </p>
            </div>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  className="bg-gradient-to-r from-blue-600 to-purple-600 text-white transition-all duration-300 hover:from-blue-700 hover:to-purple-700 hover:shadow-lg"
                  aria-label="Copy all card links in bulk for multiple formats"
                >
                  <Link className="mr-2 h-4 w-4" />
                  Copy All Links
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-96 border-white/20 bg-white/90 backdrop-blur-md dark:border-gray-600/30 dark:bg-gray-800/90">
                <div className="space-y-4">
                  <div className="mb-4">
                    <h4 className="font-semibold text-gray-900 dark:text-white">
                      Export Options
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Choose the format that works best for your needs
                    </p>
                  </div>

                  {/* SVG links copy section */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        Direct SVG Links
                      </p>
                    </div>
                    <div className="rounded-lg border border-gray-200/50 bg-gray-50/50 p-3 dark:border-gray-700/50 dark:bg-gray-800/50">
                      <textarea
                        className="w-full resize-none border-none bg-transparent text-xs text-gray-600 outline-none dark:text-gray-400"
                        value={svgLinks.join("\n")}
                        readOnly
                        rows={3}
                      />
                      <Button
                        onClick={() => handleCopyLinks("svg")}
                        size="sm"
                        className="mt-2 w-full"
                        aria-label="Copy all SVG links to clipboard"
                      >
                        {copied === "svg" ? (
                          <>
                            <Check className="mr-2 h-4 w-4" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Link className="mr-2 h-4 w-4" />
                            Copy SVG Links
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Anilist bio format copy section */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-green-500"></div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        AniList Bio Format
                      </p>
                    </div>
                    <div className="rounded-lg border border-gray-200/50 bg-gray-50/50 p-3 dark:border-gray-700/50 dark:bg-gray-800/50">
                      <textarea
                        className="w-full resize-none border-none bg-transparent text-xs text-gray-600 outline-none dark:text-gray-400"
                        value={[statsLink, ...anilistBioLinks].join("\n")}
                        readOnly
                        rows={4}
                      />
                      <Button
                        onClick={() => handleCopyLinks("anilist")}
                        size="sm"
                        className="mt-2 w-full"
                        aria-label="Copy all AniList bio format links to clipboard"
                      >
                        {copied === "anilist" ? (
                          <>
                            <Check className="mr-2 h-4 w-4" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Link className="mr-2 h-4 w-4" />
                            Copy AniList Format
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </motion.div>

      {/* Cards Grid */}
      <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {cardTypes.map((card, index) => (
          <motion.div
            key={card.rawType}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
          >
            <Card {...card} />
          </motion.div>
        ))}
      </div>
    </div>
  );
}
