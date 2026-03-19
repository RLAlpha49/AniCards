"use client";

import { motion } from "framer-motion";
import { Check, Copy } from "lucide-react";
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
      if (!navigator.clipboard) {
        return;
      }
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
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.04, 0.25) }}
      className="w-full"
    >
      <div
        className={cn(
          "group relative w-full overflow-hidden text-left",
          "border-gold/10 hover:border-gold/30 border-2 transition-all duration-300",
          "hover:shadow-gold/5 hover:-translate-y-0.5 hover:shadow-lg",
          "focus-within:border-gold/40 focus-within:shadow-gold/10 focus-within:shadow-lg",
        )}
      >
        <a
          href={variant.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${cardTypeTitle} — ${variant.name} in new tab`}
          className="absolute inset-0 z-10"
        />
        <div className="pointer-events-none relative flex items-center justify-center bg-amber-50/20 p-4 dark:bg-white/2">
          <ImageWithSkeleton
            src={variant.url}
            alt={`${cardTypeTitle} - ${variant.name}`}
            className="h-auto w-full transition-transform duration-300 group-hover:scale-[1.01]"
          />
        </div>

        <div className="border-gold/10 pointer-events-none relative flex items-center justify-between gap-2 border-t px-4 py-3">
          <div className="min-w-0">
            <p className="text-foreground line-clamp-1 text-sm font-medium">
              {variant.name}
            </p>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className={cn(
              "pointer-events-auto relative z-20 shrink-0 p-1.5 transition-colors",
              copied
                ? "text-green-600 dark:text-green-400"
                : "text-foreground/30 hover:text-gold",
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
