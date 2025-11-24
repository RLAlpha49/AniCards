/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { Download, Link, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { svgToPng, copyToClipboard, cn, getAbsoluteUrl } from "@/lib/utils";
import { LoadingSpinner } from "@/components/loading-spinner";

import { displayNames } from "../stat-card-generator/stat-card-preview";
import {
  trackCardDownload,
  trackCopyAction,
} from "@/lib/utils/google-analytics";

interface CardProps {
  type: string;
  svgUrl: string;
}

// Component for individual stat card display with download/copy actions
export function Card({ type, svgUrl }: Readonly<CardProps>) {
  // Track copied state and image loading status
  const [copied, setCopied] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Convert SVG to PNG and trigger download
  const handleDownload = async () => {
    // Track the download event
    trackCardDownload(type);

    const pngUrl = await svgToPng(svgUrl); // Utility function for conversion
    const link = document.createElement("a");
    link.href = pngUrl;
    link.download = `${type}.png`; // Set filename based on card type
    link.click();
  };

  // Generic copy handler for different link types
  const handleCopy = async (text: string, label: string) => {
    trackCopyAction(`${label}_${type}`);
    await copyToClipboard(text);
    setCopied(label); // Show success feedback
    setTimeout(() => setCopied(null), 2000);
  };

  // Pre-formatted links for copy operations
  const svgLink = getAbsoluteUrl(svgUrl);
  const anilistBioLink = `img150(${getAbsoluteUrl(svgUrl)})`; // Anilist-specific image syntax

  return (
    <div className="group relative">
      <div className="rounded-2xl border border-white/20 bg-white/10 p-6 shadow-xl backdrop-blur-sm transition-all duration-300 hover:border-white/30 hover:bg-white/15 hover:shadow-2xl dark:border-gray-700/30 dark:bg-gray-800/20 dark:hover:border-gray-600/40 dark:hover:bg-gray-700/30">
        {/* Card Header */}
        <div className="mb-4">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">
            {displayNames[type] || type}
          </h3>
          <div className="mt-1 h-1 w-12 rounded-full bg-gradient-to-r from-blue-500 to-purple-500"></div>
        </div>

        <div className="relative mb-6 overflow-hidden rounded-xl bg-gray-100/50 dark:bg-gray-800/50">
          <img
            src={svgUrl || "/placeholder.svg"}
            alt={type}
            width={400}
            height={600}
            style={{
              width: "100%",
              height: "auto",
              maxWidth: "400px",
            }}
            onLoad={() => setIsLoading(false)}
            onError={() => setIsLoading(false)}
            className={cn(
              "transition-opacity duration-300",
              isLoading ? "opacity-0" : "opacity-100",
            )}
          />

          {/* Loading overlay */}
          {isLoading && (
            <div className="absolute inset-0 flex min-h-[200px] items-center justify-center">
              <LoadingSpinner
                size="md"
                className="text-blue-500"
                text="Loading card..."
              />
            </div>
          )}
        </div>

        {/* Action buttons container */}
        <div className="flex gap-3">
          <Button
            onClick={handleDownload}
            className="flex-1 bg-gradient-to-r from-green-600 to-green-700 text-white transition-all duration-300 hover:from-green-700 hover:to-green-800 hover:shadow-lg"
            aria-label={`Download ${displayNames[type]} card as PNG image`}
          >
            <Download className="mr-2 h-4 w-4" />
            Download
          </Button>

          {/* Popover for link copy options */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="flex-1 border-blue-200 text-blue-600 transition-all duration-300 hover:border-blue-300 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-400 dark:hover:border-blue-600 dark:hover:bg-blue-900/20"
                aria-label={`Copy ${displayNames[type]} card links in various formats`}
              >
                <Link className="mr-2 h-4 w-4" />
                Copy Link
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 border-white/20 bg-white/90 backdrop-blur-md dark:border-gray-600/30 dark:bg-gray-800/90">
              <div className="space-y-4">
                <div className="mb-3">
                  <h4 className="font-semibold text-gray-900 dark:text-white">
                    Copy Options
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Choose the format that works best for you
                  </p>
                </div>

                {/* SVG link copy section */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      Direct SVG Link
                    </p>
                  </div>
                  <div className="rounded-lg border border-gray-200/50 bg-gray-50/50 p-3 dark:border-gray-700/50 dark:bg-gray-800/50">
                    <input
                      className="w-full border-none bg-transparent text-xs text-gray-600 outline-none dark:text-gray-400"
                      value={svgLink}
                      readOnly
                    />
                    <Button
                      onClick={() => handleCopy(svgLink, "svg")}
                      size="sm"
                      className="mt-2 w-full"
                      aria-label="Copy SVG link to clipboard"
                    >
                      {copied === "svg" ? (
                        <>
                          <Check className="mr-2 h-4 w-4" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Link className="mr-2 h-4 w-4" />
                          Copy SVG Link
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
                    <input
                      className="w-full border-none bg-transparent text-xs text-gray-600 outline-none dark:text-gray-400"
                      value={anilistBioLink}
                      readOnly
                    />
                    <Button
                      onClick={() => handleCopy(anilistBioLink, "anilist")}
                      size="sm"
                      className="mt-2 w-full"
                      aria-label="Copy AniList bio format link to clipboard"
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
    </div>
  );
}
