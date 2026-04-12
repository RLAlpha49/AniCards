"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Sparkles, X } from "lucide-react";

import { Button } from "@/components/ui/Button";
import {
  buildFadeUpVariants,
  buildMotionSafeStaggerContainer,
} from "@/lib/animations";
import type { SearchLookupMode } from "@/lib/seo";
import type { PendingSettingsTemplateApply } from "@/lib/user-page-settings-templates";

import { SearchForm } from "./SearchForm";

interface SearchHeroSectionProps {
  initialSearchMode: SearchLookupMode;
  initialSearchValue: string;
  onLoadingChange: (loading: boolean) => void;
  pendingTemplateApply?: PendingSettingsTemplateApply | null;
  onClearPendingTemplateApply?: () => void;
  onResumeQueuedEditor?: () => void;
  queuedEditorResumeAvailable?: boolean;
}

export function SearchHeroSection({
  initialSearchMode,
  initialSearchValue,
  onLoadingChange,
  pendingTemplateApply,
  onClearPendingTemplateApply,
  onResumeQueuedEditor,
  queuedEditorResumeAvailable = false,
}: Readonly<SearchHeroSectionProps>) {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const containerVariants = buildMotionSafeStaggerContainer({
    reducedMotion: prefersReducedMotion,
    staggerChildren: 0.1,
    delayChildren: 0.1,
  });
  const itemVariants = buildFadeUpVariants({
    reducedMotion: prefersReducedMotion,
    distance: 28,
    duration: 0.7,
  });

  return (
    <section className="relative overflow-hidden px-6 pt-28 pb-24 sm:px-12 md:pt-36 md:pb-32">
      {/* Concentric ring background — sonar/radar motif */}
      <div className="pointer-events-none absolute inset-0 search-hero-radar" />

      {/* Central gold glow */}
      <div className="
        pointer-events-none absolute top-1/3 left-1/2 h-125 w-150 -translate-1/2 rounded-full
        bg-[hsl(var(--gold)/0.06)] blur-[140px]
      " />

      {/* Floating decorative elements */}
      <motion.div
        className="pointer-events-none absolute top-24 left-[8%] text-5xl text-gold/10 select-none"
        animate={
          prefersReducedMotion
            ? undefined
            : { y: [0, -15, 0], rotate: [0, 12, 0] }
        }
        transition={
          prefersReducedMotion
            ? undefined
            : { duration: 9, repeat: Infinity, ease: "easeInOut" }
        }
      >
        ◆
      </motion.div>
      <motion.div
        className="
          pointer-events-none absolute right-[10%] bottom-32 text-3xl text-gold/8 select-none
        "
        animate={
          prefersReducedMotion
            ? undefined
            : { y: [0, 12, 0], rotate: [0, -8, 0] }
        }
        transition={
          prefersReducedMotion
            ? undefined
            : {
                duration: 7,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 2,
              }
        }
      >
        ✦
      </motion.div>
      <motion.div
        className="
          pointer-events-none absolute top-[50%] left-[5%] hidden text-2xl text-gold/6 select-none
          md:block
        "
        animate={
          prefersReducedMotion
            ? undefined
            : { y: [0, -10, 0], opacity: [0.4, 0.8, 0.4] }
        }
        transition={
          prefersReducedMotion
            ? undefined
            : {
                duration: 6,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 1,
              }
        }
      >
        ◇
      </motion.div>
      <motion.div
        className="
          pointer-events-none absolute top-[20%] right-[6%] hidden text-xl text-gold/5 select-none
          lg:block
        "
        animate={
          prefersReducedMotion
            ? undefined
            : { y: [0, 8, 0], rotate: [0, -15, 0] }
        }
        transition={
          prefersReducedMotion
            ? undefined
            : {
                duration: 10,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 3,
              }
        }
      >
        ◇
      </motion.div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 mx-auto max-w-4xl text-center"
      >
        <motion.p
          variants={itemVariants}
          className="mb-5 text-xs tracking-[0.6em] text-gold uppercase sm:text-sm"
        >
          Profile Lookup
        </motion.p>

        <motion.h1
          variants={itemVariants}
          className="
            mb-6 font-display text-5xl leading-[1.05] font-black
            sm:text-6xl
            md:text-7xl
            lg:text-8xl
          "
        >
          <span className="block text-foreground">UNLOCK</span>
          <span className="block text-gold">ANY PROFILE</span>
        </motion.h1>

        <motion.div
          variants={itemVariants}
          className="gold-line-thick mx-auto mb-8 max-w-32"
        />

        <motion.p
          variants={itemVariants}
          className="
            mx-auto mb-6 max-w-lg font-body-serif text-base/relaxed text-foreground/45
            sm:text-lg
          "
        >
          Punch in a username or ID, and we&apos;ll pull together stunning stat
          cards from any public AniList profile — ready to customize and share
          wherever you like.
        </motion.p>

        <motion.div
          variants={itemVariants}
          className="
            mb-14 flex flex-wrap justify-center gap-x-8 gap-y-2 text-xs tracking-[0.2em]
            text-foreground/30 uppercase
          "
        >
          <span>✦ Instant Results</span>
          <span>✦ No Account Needed</span>
          <span>✦ One-Click Setup</span>
        </motion.div>

        {pendingTemplateApply ? (
          <motion.div
            variants={itemVariants}
            className="
              mx-auto mb-8 max-w-3xl border border-gold/20 bg-background/70 p-4 text-left
              backdrop-blur-sm
            "
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <div className="
                  mt-0.5 flex size-9 shrink-0 items-center justify-center bg-gold/15
                  dark:bg-gold/10
                ">
                  <Sparkles className="size-4 text-gold-dim dark:text-gold" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-[0.7rem] tracking-[0.25em] text-gold/70 uppercase">
                    Queued example ready
                  </p>
                  <p className="mt-1 text-sm/relaxed text-foreground/85">
                    <span className="font-semibold text-foreground">
                      {pendingTemplateApply.templateName ??
                        "Queued example style"}
                    </span>{" "}
                    will be applied in <strong>Global Settings</strong> the next
                    time you open the editor.
                  </p>
                  <p className="mt-2 text-xs/relaxed text-foreground/55">
                    {queuedEditorResumeAvailable
                      ? "Jump back into your last loaded profile now, or search for a different AniList profile below."
                      : "Search for an AniList profile below and AniCards will carry this style into the editor automatically."}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 md:justify-end">
                {queuedEditorResumeAvailable ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={onResumeQueuedEditor}
                    className="
                      imperial-btn min-h-11 imperial-btn-fill px-4 text-xs tracking-[0.15em]
                      uppercase
                    "
                  >
                    Open last editor
                    <ArrowRight className="ml-2 size-4" aria-hidden="true" />
                  </Button>
                ) : null}

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onClearPendingTemplateApply}
                  className="
                    min-h-11 px-3 text-xs tracking-[0.15em] text-foreground/65 uppercase
                    hover:bg-gold/5 hover:text-foreground
                  "
                >
                  <X className="mr-1.5 size-4" aria-hidden="true" />
                  Clear queued style
                </Button>
              </div>
            </div>
          </motion.div>
        ) : null}

        <motion.div variants={itemVariants}>
          <SearchForm
            initialSearchMode={initialSearchMode}
            initialSearchValue={initialSearchValue}
            onLoadingChange={onLoadingChange}
          />
        </motion.div>
      </motion.div>
    </section>
  );
}
