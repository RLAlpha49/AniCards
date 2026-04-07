"use client";

import { motion } from "framer-motion";
import { Check, Copy, ExternalLink, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { CardPreviewPlaceholder } from "@/components/CardPreviewPlaceholder";
import { ImageWithSkeleton } from "@/components/ImageWithSkeleton";
import {
  DARK_PREVIEW_COLOR_PRESET,
  LIGHT_PREVIEW_COLOR_PRESET,
  type PreviewColorPreset,
  selectThemePreviewUrl,
} from "@/lib/preview-theme";
import type { SettingsTemplateV1 } from "@/lib/user-page-settings-io";
import {
  queuePendingSettingsTemplateApply,
  upsertSettingsTemplateInStorage,
} from "@/lib/user-page-settings-templates";
import { cn, toCardApiHref } from "@/lib/utils";

import type { ExampleCardVariant } from "./types";

interface ExampleCardProps {
  variant: ExampleCardVariant;
  cardTypeTitle: string;
  previewColorPreset: PreviewColorPreset | null;
  index?: number;
}

function getSelectedSettingsSnapshot(
  variant: ExampleCardVariant,
  previewColorPreset: PreviewColorPreset | null,
) {
  if (previewColorPreset === DARK_PREVIEW_COLOR_PRESET) {
    return variant.settingsSnapshots.dark;
  }

  if (previewColorPreset === LIGHT_PREVIEW_COLOR_PRESET) {
    return variant.settingsSnapshots.light;
  }

  return null;
}

function buildButtonLabels(opts: {
  isPreviewReady: boolean;
  copied: boolean;
  queuedForEditor: boolean;
}) {
  let copy = "Preview is still loading";
  let editor = "Pick a preview theme to use this style";

  if (opts.isPreviewReady) {
    copy = opts.copied ? "Copied!" : "Copy embed URL";
    editor = opts.queuedForEditor
      ? "Queued for editor"
      : "Use this style in the editor";
  }

  return {
    copy,
    editor,
  };
}

function buildExampleTemplateId(
  cardTypeTitle: string,
  variantName: string,
  themeLabel: string,
): string {
  const slugify = (value: string): string => {
    const trimmed = value.trim().toLowerCase();
    let slug = "";
    let pendingSeparator = false;

    for (const char of trimmed) {
      const code = char.codePointAt(0);
      const isLowerAlphaNumeric =
        code !== undefined &&
        ((code >= 97 && code <= 122) || (code >= 48 && code <= 57));

      if (isLowerAlphaNumeric) {
        if (pendingSeparator && slug.length > 0) {
          slug += "-";
        }

        pendingSeparator = false;
        slug += char;
      } else if (slug.length > 0) {
        pendingSeparator = true;
      }
    }

    return slug;
  };

  return [
    "example",
    slugify(cardTypeTitle),
    slugify(variantName),
    slugify(themeLabel),
  ].join(":");
}

export function ExampleCard({
  variant,
  cardTypeTitle,
  previewColorPreset,
  index = 0,
}: Readonly<ExampleCardProps>) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [queuedForEditor, setQueuedForEditor] = useState(false);
  const previewUrl = selectThemePreviewUrl(
    variant.previewUrls,
    previewColorPreset,
  );
  const previewHref = previewUrl
    ? (toCardApiHref(previewUrl) ?? previewUrl)
    : undefined;
  const selectedSettingsSnapshot = getSelectedSettingsSnapshot(
    variant,
    previewColorPreset,
  );
  const isPreviewReady = previewUrl !== undefined;
  const buttonLabels = buildButtonLabels({
    isPreviewReady,
    copied,
    queuedForEditor,
  });

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [copied]);

  useEffect(() => {
    if (queuedForEditor) {
      const timer = setTimeout(() => setQueuedForEditor(false), 2500);
      return () => clearTimeout(timer);
    }
  }, [queuedForEditor]);

  const handleCopy = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (!isPreviewReady || !navigator.clipboard || !previewHref) return;

      try {
        await navigator.clipboard.writeText(
          new URL(previewHref, globalThis.window.location.origin).toString(),
        );
        setCopied(true);
      } catch (error) {
        console.error("Failed to copy:", error);
      }
    },
    [isPreviewReady, previewHref],
  );

  const handleUseInEditor = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();

      if (!selectedSettingsSnapshot || !previewColorPreset) return;

      const themeLabel =
        previewColorPreset === DARK_PREVIEW_COLOR_PRESET ? "Dark" : "Light";
      const now = Date.now();
      const template: SettingsTemplateV1 = {
        id: buildExampleTemplateId(cardTypeTitle, variant.name, themeLabel),
        name: `${cardTypeTitle} — ${variant.name} (${themeLabel})`,
        snapshot: selectedSettingsSnapshot,
        createdAt: now,
        updatedAt: now,
      };

      upsertSettingsTemplateInStorage(template);
      queuePendingSettingsTemplateApply({
        templateId: template.id,
        templateName: template.name,
        applyTo: "global",
        source: "examples",
        queuedAt: now,
      });

      setQueuedForEditor(true);
      toast.success("Style queued for your editor", {
        description:
          "Pick a user and AniCards will apply this example as a reusable template.",
      });
      router.push("/search");
    },
    [
      cardTypeTitle,
      previewColorPreset,
      router,
      selectedSettingsSnapshot,
      variant.name,
    ],
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
          "group/card relative overflow-hidden rounded-sm",
          "border border-transparent transition-all duration-500",
          "hover:border-gold/20",
          "hover:shadow-[0_16px_48px_-12px_hsl(var(--gold)/0.1)]",
          "group-focus-visible/card:border-gold/20",
          "group-focus-visible/card:shadow-[0_16px_48px_-12px_hsl(var(--gold)/0.1)]",
          "group-focus-visible/card:ring-2",
          "group-focus-visible/card:ring-gold/50",
          "group-focus-visible/card:ring-offset-2",
          "group-focus-visible/card:ring-offset-background",
        )}
      >
        {/* Full-card link overlay */}
        {isPreviewReady && previewHref && (
          <a
            href={previewHref}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open ${cardTypeTitle} — ${variant.name} in new tab`}
            className="absolute inset-0 z-10 rounded-[inherit] focus-visible:outline-none"
          />
        )}

        {/* Image area with cinematic treatment */}
        <div className="
          relative overflow-hidden bg-[hsl(var(--foreground)/0.02)]
          dark:bg-[hsl(var(--foreground)/0.02)]
        ">
          {/* Subtle vignette on hover */}
          <div className="
            pointer-events-none absolute inset-0 z-2 opacity-0 transition-opacity duration-500
            group-hover/card:opacity-100
            group-focus-visible/card:opacity-100
          ">
            <div className="
              size-full
              bg-[radial-gradient(ellipse_at_center,transparent_40%,hsl(var(--background)/0.3))]
            " />
          </div>

          <div className="
            flex justify-center p-4 transition-transform duration-700 ease-out
            group-hover/card:scale-[1.03]
            group-focus-visible/card:scale-[1.03]
          ">
            {isPreviewReady && previewHref ? (
              <ImageWithSkeleton
                src={previewHref}
                alt={`${cardTypeTitle} - ${variant.name}`}
                className="h-auto w-full"
                width={variant.width}
                height={variant.height}
              />
            ) : (
              <CardPreviewPlaceholder
                className="w-full"
                aspectRatio={
                  variant.width && variant.height
                    ? variant.width / variant.height
                    : undefined
                }
              />
            )}
          </div>

          {/* Hover action badge */}
          {isPreviewReady && previewHref && (
            <div className="
              pointer-events-none absolute inset-0 z-3 flex items-center justify-center
            ">
              <motion.div
                className="
                  flex items-center gap-1.5 bg-[hsl(var(--gold)/0.9)] px-3 py-1.5 text-[0.65rem]
                  font-semibold tracking-wider text-[#0c0a10] uppercase opacity-0 shadow-lg
                  transition-all duration-400
                  group-hover/card:opacity-100
                  group-focus-visible/card:opacity-100
                "
                style={{ transitionDelay: "50ms" }}
              >
                <ExternalLink className="size-3" />
                Open Full Size
              </motion.div>
            </div>
          )}
        </div>

        {/* Footer bar */}
        <div className="
          flex items-center justify-between gap-2 border-t border-[hsl(var(--gold)/0.06)]
          bg-[hsl(var(--gold)/0.01)] px-4 py-3
        ">
          <p className="line-clamp-1 text-xs font-medium tracking-wide text-foreground/55">
            {variant.name}
          </p>
          <div className="relative z-20 flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleUseInEditor}
              className={cn(
                `
                  pointer-events-auto inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1
                  text-[10px] font-semibold tracking-[0.18em] uppercase transition-all duration-200
                  focus-visible:border-gold/35 focus-visible:ring-2 focus-visible:ring-gold/50
                  focus-visible:ring-offset-2 focus-visible:ring-offset-background
                  focus-visible:outline-none
                `,
                !selectedSettingsSnapshot && "cursor-not-allowed opacity-50",
                queuedForEditor
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : `
                    border-gold/20 bg-gold/8 text-gold-dim
                    hover:border-gold/35 hover:bg-gold/12
                    dark:text-gold
                  `,
              )}
              aria-label={buttonLabels.editor}
              disabled={!selectedSettingsSnapshot}
            >
              <Sparkles className="size-3" />
              <span className="hidden sm:inline">
                {queuedForEditor ? "Queued" : "Use in editor"}
              </span>
            </button>

            <button
              type="button"
              onClick={handleCopy}
              className={cn(
                `
                  pointer-events-auto shrink-0 rounded-full p-1.5 transition-all duration-200
                  focus-visible:text-gold focus-visible:ring-2 focus-visible:ring-gold/50
                  focus-visible:ring-offset-2 focus-visible:ring-offset-background
                  focus-visible:outline-none
                `,
                !isPreviewReady && "cursor-not-allowed opacity-50",
                copied
                  ? "text-emerald-500 dark:text-emerald-400"
                  : "text-foreground/15 hover:text-gold",
              )}
              aria-label={buttonLabels.copy}
              disabled={!isPreviewReady}
            >
              {copied ? (
                <Check className="size-3.5" />
              ) : (
                <Copy className="size-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
