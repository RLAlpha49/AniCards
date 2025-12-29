"use client";

import { useCallback, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/Card";
import { ImageWithSkeleton } from "@/components/ImageWithSkeleton";
import { Expand, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface CardVariant {
  name: string;
  url: string;
  description?: string;
}

interface ExampleCardProps {
  variant: CardVariant;
  cardTypeTitle: string;
  gradient: string;
  onOpenLightbox: () => void;
  index?: number;
}

/**
 * Redesigned example card with larger preview, lightbox trigger, and quick copy.
 */
export function ExampleCard({
  variant,
  cardTypeTitle,
  gradient,
  onOpenLightbox,
  index = 0,
}: Readonly<ExampleCardProps>) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        await navigator.clipboard.writeText(variant.url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (error) {
        console.error("Failed to copy:", error);
      }
    },
    [variant.url],
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.03, 0.3) }}
      className="w-full"
    >
      <Card
        className={cn(
          "group cursor-pointer overflow-hidden border-0 bg-white/80 shadow-lg shadow-slate-200/50 backdrop-blur-sm",
          "transition-all duration-300 hover:-translate-y-1 hover:shadow-xl",
          "dark:bg-slate-800/80 dark:shadow-slate-900/50",
        )}
        onClick={onOpenLightbox}
      >
        <CardContent className="p-0">
          {/* Card preview area */}
          <div className="relative overflow-hidden bg-gradient-to-br from-slate-100 to-slate-50 p-4 dark:from-slate-900 dark:to-slate-800 sm:p-6">
            {/* Decorative gradient blob */}
            <div
              className={cn(
                "absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-r opacity-20 blur-2xl transition-all group-hover:scale-150 group-hover:opacity-30",
                gradient,
              )}
            />

            {/* Card image */}
            <div className="relative flex items-center justify-center">
              <ImageWithSkeleton
                src={variant.url}
                alt={`${cardTypeTitle} - ${variant.name}`}
                className="h-auto w-full rounded-lg shadow-sm transition-transform duration-300 group-hover:scale-[1.02]"
              />
            </div>

            {/* Hover overlay */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-900/0 transition-colors duration-300 group-hover:bg-slate-900/50">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileHover={{ opacity: 1, scale: 1 }}
                className="pointer-events-none flex items-center gap-2 rounded-full bg-white/95 px-4 py-2 font-medium text-slate-900 opacity-0 shadow-lg backdrop-blur-sm transition-all duration-300 group-hover:opacity-100"
              >
                <Expand className="h-4 w-4" />
                View Full Size
              </motion.div>
            </div>
          </div>

          {/* Card info footer */}
          <div className="p-4 sm:p-5">
            <div className="mb-1 flex items-start justify-between gap-2">
              <h4 className="line-clamp-1 font-bold text-slate-900 dark:text-white">
                {variant.name}
              </h4>
              <button
                onClick={handleCopy}
                className={cn(
                  "shrink-0 rounded-full p-1.5 transition-all",
                  copied
                    ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                    : "text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-300",
                )}
                aria-label={copied ? "Copied!" : "Copy embed URL"}
              >
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>
            <p className="line-clamp-1 text-sm text-slate-500 dark:text-slate-400">
              {cardTypeTitle}
            </p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
