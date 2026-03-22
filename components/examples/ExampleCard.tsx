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
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{
        duration: 0.5,
        delay: Math.min(index * 0.05, 0.25),
        ease: [0.22, 1, 0.36, 1],
      }}
      className="w-full"
    >
      <div
        className={cn(
          "group/card relative overflow-hidden",
          "border border-transparent transition-all duration-500",
          "hover:border-gold/20",
          "hover:shadow-[0_16px_48px_-12px_hsl(var(--gold)/0.1)]",
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

        {/* Image area with cinematic treatment */}
        <div className="
          relative overflow-hidden bg-[hsl(var(--foreground)/0.02)]
          dark:bg-[hsl(var(--foreground)/0.02)]
        ">
          {/* Subtle vignette on hover */}
          <div className="
            pointer-events-none absolute inset-0 z-2 opacity-0 transition-opacity duration-500
            group-hover/card:opacity-100
          ">
            <div className="
              size-full
              bg-[radial-gradient(ellipse_at_center,transparent_40%,hsl(var(--background)/0.3))]
            " />
          </div>

          <div className="
            flex justify-center p-4 transition-transform duration-700 ease-out
            group-hover/card:scale-[1.03]
          ">
            <ImageWithSkeleton
              src={variant.url}
              alt={`${cardTypeTitle} - ${variant.name}`}
              className="h-auto w-full"
            />
          </div>

          {/* Hover action badge */}
          <div className="pointer-events-none absolute inset-0 z-3 flex items-center justify-center">
            <motion.div
              className="
                flex items-center gap-1.5 bg-[hsl(var(--gold)/0.9)] px-3 py-1.5 text-[0.65rem]
                font-semibold tracking-wider text-[#0c0a10] uppercase opacity-0 shadow-lg
                transition-all duration-400
                group-hover/card:opacity-100
              "
              style={{ transitionDelay: "50ms" }}
            >
              <ExternalLink className="size-3" />
              Open Full Size
            </motion.div>
          </div>
        </div>

        {/* Footer bar */}
        <div className="
          flex items-center justify-between gap-2 border-t border-[hsl(var(--gold)/0.06)]
          bg-[hsl(var(--gold)/0.01)] px-4 py-3
        ">
          <p className="line-clamp-1 text-xs font-medium tracking-wide text-foreground/55">
            {variant.name}
          </p>
          <button
            type="button"
            onClick={handleCopy}
            className={cn(
              "pointer-events-auto relative z-20 shrink-0 p-1.5 transition-all duration-200",
              copied
                ? "text-emerald-500 dark:text-emerald-400"
                : "text-foreground/15 hover:text-gold",
            )}
            aria-label={copied ? "Copied!" : "Copy embed URL"}
          >
            {copied ? (
              <Check className="size-3.5" />
            ) : (
              <Copy className="size-3.5" />
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
