import { useState } from "react";
import Image from "next/image";
import { Download, Link, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { svgToPng, copyToClipboard } from "@/lib/utils";
import { LoadingSpinner } from "@/components/loading-spinner";
import { cn } from "@/lib/utils";
import { displayNames } from "../stat-card-generator/stat-card-preview";

interface CardProps {
  type: string;
  svgUrl: string;
}

// Component for individual stat card display with download/copy actions
export function Card({ type, svgUrl }: CardProps) {
  // Track copied state and image loading status
  const [copied, setCopied] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Convert SVG to PNG and trigger download
  const handleDownload = async () => {
    const pngUrl = await svgToPng(svgUrl); // Utility function for conversion
    const link = document.createElement("a");
    link.href = pngUrl;
    link.download = `${type}.png`; // Set filename based on card type
    link.click();
  };

  // Generic copy handler for different link types
  const handleCopy = async (text: string, label: string) => {
    await copyToClipboard(text);
    setCopied(label); // Show success feedback
    setTimeout(() => setCopied(null), 2000);
  };

  // Pre-formatted links for copy operations
  const svgLink = svgUrl;
  const anilistBioLink = `img150(${svgUrl})`; // Anilist-specific image syntax

  return (
    <div className="relative">
      {/* Card container with hover effects */}
      <div className="space-y-4 rounded-lg border-2 border-gray-800 p-4 transition duration-300 hover:border-blue-500 hover:shadow-lg dark:border-gray-300">
        <h3 className="text-lg font-semibold">
          {displayNames[type] || type} {/* Use display name if available */}
        </h3>

        {/* Image container with loading state */}
        <div className="relative aspect-video">
          <Image
            src={svgUrl || "/placeholder.svg"}
            alt={type}
            fill
            style={{ objectFit: "contain" }}
            onLoad={() => setIsLoading(false)}
            onError={() => setIsLoading(false)}
            className={cn(
              "h-[210px] w-[150px]",
              isLoading ? "invisible" : "visible",
            )}
          />
        </div>

        {/* Action buttons container */}
        <div className="flex space-x-2">
          <Button onClick={handleDownload}>
            <Download className="mr-2 h-4 w-4" /> Download PNG
          </Button>

          {/* Popover for link copy options */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">
                <Link className="mr-2 h-4 w-4" /> Copy Link
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80">
              {/* SVG link copy section */}
              <div className="space-y-2">
                <div>
                  <p className="text-sm font-medium">SVG Link</p>
                  <div className="mt-1 flex">
                    <input /* Read-only input for link display */
                      className="flex-grow rounded-l-md border px-3 py-2 text-sm"
                      value={svgLink}
                      readOnly
                    />
                    <Button
                      onClick={() => handleCopy(svgLink, "svg")}
                      className="rounded-l-none border px-3 py-2 text-sm"
                      style={{ height: "auto" }}
                    >
                      {copied === "svg" ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        "Copy"
                      )}
                    </Button>
                  </div>
                </div>

                {/* Anilist bio format copy section */}
                <div>
                  <p className="text-sm font-medium">Anilist Bio Example</p>
                  <div className="mt-1 flex">
                    <input
                      className="flex-grow rounded-l-md border px-3 py-2 text-sm"
                      value={anilistBioLink}
                      readOnly
                    />
                    <Button
                      onClick={() => handleCopy(anilistBioLink, "anilist")}
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
        </div>
      </div>

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <LoadingSpinner
            size="md"
            className="text-primary/50"
            text="Loading card..."
          />
        </div>
      )}
    </div>
  );
}
