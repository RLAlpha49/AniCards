"use client";

import { motion } from "framer-motion";
import {
  AlertTriangle,
  ExternalLink,
  Heart,
  Info,
  RefreshCw,
  UserPlus,
  X,
} from "lucide-react";
import { useMemo } from "react";

import { Button } from "@/components/ui/Button";
import { ColorValueSwatch } from "@/components/ui/ColorValueSwatch";
import type { EditorStarterStyle } from "@/lib/user-page-starters";
import { escapeForXml, processColorsForSVG } from "@/lib/utils";

import { DraftRestoreNotice } from "./DraftRestoreNotice";
import { SaveConflictNotice } from "./SaveConflictNotice";

type StarterPreviewColor = EditorStarterStyle["snapshot"]["colors"][number];

function starterColorToSolid(value: StarterPreviewColor): string {
  return typeof value === "string"
    ? value
    : (value.stops[0]?.color ?? "#d5a944");
}

function buildStarterStylePreviewDataUri(
  starterStyle: EditorStarterStyle,
): string {
  const [titleColor, backgroundColor, textColor, accentColor] =
    starterStyle.snapshot.colors;
  const { gradientDefs, resolvedColors } = processColorsForSVG(
    {
      titleColor,
      backgroundColor,
      textColor,
      accentColor,
    },
    ["titleColor", "backgroundColor", "textColor", "accentColor"],
  );
  const accentSolid = starterColorToSolid(accentColor);
  const bars = [0.55, 0.8, 0.65, 0.95]
    .map((scale, index) => {
      const height = Math.round(42 * scale * 100) / 100;
      const y = Math.round((78 - height) * 100) / 100;
      const x = 18 + index * 34;

      return `<rect x="${x}" y="${y}" width="26" height="${height}" rx="3" fill="${index % 2 === 0 ? resolvedColors.accentColor : resolvedColors.textColor}" fill-opacity="${index % 2 === 0 ? "0.85" : "0.38"}" />`;
    })
    .join("");

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 92" fill="none">
      <defs>${gradientDefs}</defs>
      <rect x="0.5" y="0.5" width="179" height="91" rx="8" fill="${resolvedColors.backgroundColor}" stroke="${escapeForXml(accentSolid)}" stroke-opacity="0.12" />
      <line x1="0" y1="24.5" x2="180" y2="24.5" stroke="${escapeForXml(accentSolid)}" stroke-opacity="0.2" />
      <text x="12" y="16" font-family="Inter, system-ui, sans-serif" font-size="10" font-weight="700" fill="${resolvedColors.titleColor}">AniCards preview</text>
      <circle cx="166" cy="12" r="5" fill="${resolvedColors.accentColor}" />
      ${bars}
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function StarterStyleCard({
  starterStyle,
  onApply,
}: Readonly<{
  starterStyle: EditorStarterStyle;
  onApply: (starterStyle: EditorStarterStyle) => void;
}>) {
  const starterPreviewSrc = useMemo(
    () => buildStarterStylePreviewDataUri(starterStyle),
    [starterStyle],
  );

  return (
    <button
      type="button"
      onClick={() => onApply(starterStyle)}
      className="
        group text-left transition-transform duration-200
        hover:-translate-y-0.5
        focus:outline-none
        focus-visible:ring-2 focus-visible:ring-gold/60 focus-visible:ring-offset-2
      "
      aria-label={`Apply ${starterStyle.name} starter style`}
    >
      <div className="
        border border-gold/20 bg-background/75 p-3 shadow-sm transition-colors
        group-hover:border-gold/35
        dark:border-gold/15
      ">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-display text-[11px] tracking-[0.16em] text-foreground uppercase">
              {starterStyle.name}
            </p>
            <span className="
              mt-2 inline-flex items-center border border-gold/20 bg-gold/8 px-2 py-1 text-[10px]
              font-semibold tracking-[0.14em] text-gold-dim uppercase
              dark:text-gold
            ">
              {starterStyle.intentLabel}
            </span>
          </div>

          <span className="
            text-[10px] font-semibold tracking-[0.16em] text-gold-dim uppercase
            dark:text-gold
          ">
            Apply
          </span>
        </div>

        <div className="mt-3 border border-gold/15 bg-background/70 p-2 dark:border-gold/10">
          <div
            className="overflow-hidden border border-gold/10"
            aria-hidden="true"
          >
            <img
              src={starterPreviewSrc}
              alt=""
              className="block w-full"
              loading="lazy"
              decoding="async"
            />
          </div>

          <div className="mt-2 flex gap-1.5" aria-hidden="true">
            {starterStyle.snapshot.colors.map((color, index) => (
              <ColorValueSwatch
                key={`${starterStyle.id}-swatch-${index}`}
                className="h-2 flex-1 rounded-full"
                cornerRadius={50}
                value={color}
              />
            ))}
          </div>
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          {starterStyle.description}
        </p>
      </div>
    </button>
  );
}

export function EditorNotices({
  showConflictNotice,
  conflictNoticeSummary,
  onResolveConflictKeepEdits,
  onResolveConflictDiscardEdits,
  showDraftNotice,
  draftNoticeMode,
  draftSavedAt,
  onRestoreDraft,
  onDiscardDraft,
  onDismissDraftNotice,
  isNewUser,
  onDismissNewUser,
  starterStyles,
  onApplyStarterStyle,
  onOpenHelp,
  onStartTour,
  cardsWarning,
  onDismissCardsWarning,
}: Readonly<{
  showConflictNotice: boolean;
  conflictNoticeSummary?: {
    attemptedAt: number;
    changedCardCount: number;
    changedCards: Array<{
      cardId: string;
      group?: string;
      label: string;
    }>;
    changedGlobalSettingCount: number;
    currentUpdatedAt?: string;
    lastSavedAt: number | null;
    remainingChangedCardCount: number;
    reorderedCardCount: number;
  } | null;
  onResolveConflictKeepEdits: () => void;
  onResolveConflictDiscardEdits: () => void;
  showDraftNotice: boolean;
  draftNoticeMode?: "draft" | "exit-save-fallback";
  draftSavedAt?: number | null;
  onRestoreDraft: () => void;
  onDiscardDraft: () => void;
  onDismissDraftNotice: () => void;
  isNewUser: boolean;
  onDismissNewUser: () => void;
  starterStyles: readonly EditorStarterStyle[];
  onApplyStarterStyle: (starterStyle: EditorStarterStyle) => void;
  onOpenHelp: () => void;
  onStartTour: () => void;
  cardsWarning: string | null;
  onDismissCardsWarning: () => void;
}>) {
  return (
    <div className="mx-auto mt-6 flex max-w-[80vw] flex-col gap-4">
      <SaveConflictNotice
        isVisible={showConflictNotice}
        summary={conflictNoticeSummary}
        onKeepEdits={onResolveConflictKeepEdits}
        onReloadLatest={onResolveConflictDiscardEdits}
      />

      <DraftRestoreNotice
        isVisible={showDraftNotice}
        mode={draftNoticeMode}
        savedAt={draftSavedAt}
        onRestore={onRestoreDraft}
        onDiscard={onDiscardDraft}
        onDismiss={onDismissDraftNotice}
      />

      {isNewUser && (
        <div className="flex justify-center">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="
              w-full max-w-125 border border-green-200/60 bg-linear-to-r from-green-50/80
              to-emerald-50/80 px-4 py-3 backdrop-blur-sm
              dark:border-green-800/40 dark:from-green-950/30 dark:to-emerald-950/30
            "
          >
            <div className="flex items-start gap-3">
              <div className="
                mt-0.5 flex size-8 shrink-0 items-center justify-center bg-green-100
                dark:bg-green-900/50
              ">
                <UserPlus className="size-4 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-green-800 dark:text-green-200">
                  <span className="font-medium">Welcome to AniCards!</span> Your
                  profile is ready with a curated starter set. Pick a starter
                  style below, then tweak anything you like in Global Settings.
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onDismissNewUser}
                className="
                  size-6 shrink-0 rounded-full p-0 text-green-600
                  hover:bg-green-100 hover:text-green-800
                  dark:text-green-400
                  dark:hover:bg-green-900/50 dark:hover:text-green-200
                "
                aria-label="Dismiss welcome notice"
              >
                <X className="size-4" />
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      {isNewUser && (
        <div className="flex justify-center">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className="
              w-full max-w-[700px] border border-gold/20 bg-gold/3 p-4 backdrop-blur-sm
              dark:border-gold/15 dark:bg-gold/3
            "
          >
            <div className="flex items-start gap-3">
              <div className="
                mt-0.5 flex size-8 shrink-0 items-center justify-center bg-gold/15
                dark:bg-gold/10
              ">
                <Info
                  className="size-4 text-gold-dim dark:text-gold"
                  aria-hidden="true"
                />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-foreground">
                  Quick start
                </h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  <li>
                    Start with the curated cards below — you can enable the rest
                    whenever you're ready.
                  </li>
                  <li>
                    Try one of the visual starter looks here, then open{" "}
                    <strong>Global Settings</strong> to fine-tune it.
                  </li>
                  <li>
                    Use the quick filter chips under search when you want to
                    jump straight to a group, enabled state, or custom cards.
                  </li>
                  <li>
                    Want more looks? The live examples gallery can pipe a style
                    straight into this editor as a reusable template.
                  </li>
                </ul>

                <div className="mt-4">
                  <p className="
                    text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase
                  ">
                    Starter looks
                  </p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    {starterStyles.map((starterStyle) => (
                      <StarterStyleCard
                        key={starterStyle.id}
                        starterStyle={starterStyle}
                        onApply={onApplyStarterStyle}
                      />
                    ))}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <a
                    href="/examples"
                    className="
                      inline-flex items-center gap-1.5 border border-gold/20 bg-gold/8 px-3 py-2
                      text-xs font-semibold tracking-[0.16em] text-gold-dim uppercase
                      transition-colors
                      hover:border-gold/35 hover:bg-gold/12
                      dark:text-gold
                    "
                  >
                    Browse examples
                    <ExternalLink className="size-3" />
                  </a>
                </div>

                <p className="mt-3 text-xs text-muted-foreground">
                  Example styles land in the same template library used by the
                  editor, so you can reapply them later instead of rebuilding a
                  look from scratch.
                </p>

                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full sm:w-auto"
                    onClick={onOpenHelp}
                    aria-haspopup="dialog"
                  >
                    Learn more
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={onStartTour}
                  >
                    Start tour
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {cardsWarning && (
        <div className="flex justify-center">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="
              w-full max-w-[700px] border border-yellow-200/60 bg-linear-to-r from-yellow-50/80
              to-amber-50/80 px-4 py-3 backdrop-blur-sm
              dark:border-yellow-800/40 dark:from-yellow-950/30 dark:to-amber-950/30
            "
          >
            <div className="flex items-start gap-3">
              <div className="
                mt-0.5 flex size-8 shrink-0 items-center justify-center bg-yellow-100
                dark:bg-yellow-900/50
              ">
                <AlertTriangle className="size-4 text-yellow-700 dark:text-yellow-300" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  <span className="font-medium">
                    Problem loading saved cards:
                  </span>{" "}
                  {cardsWarning}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onDismissCardsWarning}
                className="
                  size-6 shrink-0 rounded-full p-0 text-yellow-700
                  hover:bg-yellow-100 hover:text-yellow-900
                  dark:text-yellow-300
                  dark:hover:bg-yellow-900/50 dark:hover:text-yellow-100
                "
                aria-label="Dismiss card loading warning"
              >
                <X className="size-4" />
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      <div className="flex flex-col justify-center gap-4 md:flex-row md:flex-wrap lg:flex-nowrap">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="
            max-w-[500px] flex-1 border border-gold/20 bg-linear-to-r from-gold/5 to-amber-100/5
            px-4 py-3 backdrop-blur-sm
            dark:border-gold/15 dark:from-gold/3 dark:to-amber-900/3
          "
        >
          <div className="flex items-start gap-3">
            <div className="
              mt-0.5 flex size-8 shrink-0 items-center justify-center bg-gold/15
              dark:bg-gold/10
            ">
              <RefreshCw className="size-4 text-gold-dim dark:text-gold" />
            </div>
            <p className="text-sm text-foreground">
              <span className="font-medium">Set it and forget it!</span> Stats
              update automatically every day. Your card URLs always show the
              latest data.
            </p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="
            max-w-[500px] flex-1 border border-gold/20 bg-linear-to-r from-gold/5 via-amber-100/5
            to-gold/3 px-4 py-3 backdrop-blur-sm
            dark:border-gold/15 dark:from-gold/3 dark:via-amber-900/3 dark:to-gold/2
          "
        >
          <div className="flex items-start gap-3">
            <div className="
              mt-0.5 flex size-8 shrink-0 items-center justify-center bg-linear-to-br from-gold
              via-amber-500 to-gold-dim shadow-lg shadow-gold/20
            ">
              <Heart className="size-4 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-foreground">
                <span className="font-medium">Enjoying AniCards?</span> If you
                find this project useful, consider crediting it in your AniList
                bio. It helps others discover AniCards!
              </p>
            </div>
            <a
              href="https://anilist.co/user/Alpha49"
              target="_blank"
              rel="noopener noreferrer"
              className="
                mt-0.5 inline-flex items-center gap-1.5 border border-gold/20 bg-gold/5 px-2.5 py-1
                text-xs font-medium text-gold-dim transition-all
                hover:border-gold/30 hover:bg-gold/10
                dark:border-gold/15 dark:bg-gold/5 dark:text-gold
                dark:hover:border-gold/25
              "
            >
              <ExternalLink className="size-3" />
              @Alpha49
            </a>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
