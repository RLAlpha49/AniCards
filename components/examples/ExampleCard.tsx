"use client";

import { motion } from "framer-motion";
import { Check, Copy, ExternalLink } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { ImageWithSkeleton } from "@/components/ImageWithSkeleton";
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
  index?: number;
}

export function ExampleCard({
  variant,
  cardTypeTitle,
  index = 0,
}: Readonly<ExampleCardProps>) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [copied]);

  const handleCopy = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (!navigator.clipboard) return;
      try {
        await navigator.clipboard.writeText(variant.url);
        setCopied(true);
      } catch (error) {
        console.error("Failed to copy:", error);
      }
    },
    [variant.url],
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.04, 0.2) }}
      className="group/card w-full"
    >
      <div
        className={cn(
          "relative overflow-hidden",
          "border-gold/8 border transition-all duration-300",
          "hover:border-gold/25 hover:-translate-y-0.5",
          "hover:shadow-[0_8px_30px_-8px_hsl(var(--gold)/0.12)]",
        )}
      >
        {/* Full-card link overlay */}
        <a
          href={variant.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${cardTypeTitle} — ${variant.name} in new tab`}
          className="absolute inset-0 z-10"
        />

        {/* Image area */}
        <div className="bg-foreground/1.5 relative flex items-center justify-center p-4 dark:bg-white/1.5">
          <ImageWithSkeleton
            src={variant.url}
            alt={`${cardTypeTitle} - ${variant.name}`}
            className="h-auto w-full transition-transform duration-500 ease-out group-hover/card:scale-[1.015]"
          />

          {/* Hover overlay */}
          <div className="bg-background/0 group-hover/card:bg-background/50 pointer-events-none absolute inset-0 flex items-center justify-center transition-colors duration-300">
            <span className="text-gold inline-flex items-center gap-1.5 text-xs font-medium tracking-wide opacity-0 transition-opacity duration-300 group-hover/card:opacity-100">
              <ExternalLink className="h-3.5 w-3.5" />
              Open
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="border-gold/8 flex items-center justify-between gap-2 border-t px-3.5 py-2.5">
          <p className="text-foreground/60 line-clamp-1 text-xs font-medium">
            {variant.name}
          </p>
          <button
            type="button"
            onClick={handleCopy}
            className={cn(
              "pointer-events-auto relative z-20 shrink-0 p-1 transition-all duration-200",
              copied
                ? "text-emerald-500 dark:text-emerald-400"
                : "text-foreground/20 hover:text-gold",
            )}
            aria-label={copied ? "Copied!" : "Copy embed URL"}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
