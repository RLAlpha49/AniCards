"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useStatCardSubmit } from "@/hooks/useStatCardSubmit";
import { useGeneratorDraft } from "@/hooks/useGeneratorDraft";
import { usePageSEO } from "@/hooks/usePageSEO";
import { ErrorPopup } from "@/components/ErrorPopup";
import { PaperSurface } from "@/components/PaperSurface";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { List, Sparkles } from "@/lib/icons";
import { getErrorDetails, type ErrorDetails } from "@/lib/error-messages";
import {
  safeTrack,
  trackButtonClick,
  trackCardGeneration,
  trackUserSearch,
} from "@/lib/utils/google-analytics";
import { type PreviewOptions } from "./card-options";
import { GeneratingOverlay } from "./GeneratingOverlay";
import { StepRail, type Step } from "./StepRail";
import { PreviewPanel } from "./PreviewPanel";
import { UsernameStep } from "./steps/UsernameStep";
import { PaletteStep } from "./steps/PaletteStep";
import { CardsStep } from "./steps/CardsStep";
import { OptionsStep } from "./steps/OptionsStep";
import styles from "./generator.module.css";

/** Step identifiers, in the order the rail lists them. @source */
const STEP_IDS = ["username", "palette", "cards", "finish"] as const;
type StepId = (typeof STEP_IDS)[number];

/** Step metadata that does not depend on the draft. @source */
const STEP_META: Record<
  StepId,
  { label: string; numeral: string; title: string }
> = {
  username: { label: "Username", numeral: "壱", title: "Whose stats?" },
  palette: { label: "Palette", numeral: "弐", title: "Colours" },
  cards: { label: "Cards", numeral: "参", title: "Choose your cards" },
  finish: { label: "Finish", numeral: "肆", title: "Final details" },
};

/**
 * Reads an error's user-facing copy, preferring details the submit hook
 * already attached before falling back to parsing the message.
 * @param error - Error from the submission hook.
 * @source
 */
function resolveErrorDetails(error: Error | null): ErrorDetails | null {
  if (!error) return null;
  const attached = error as Error & { details?: ErrorDetails };
  if (attached.details) return attached.details;
  return getErrorDetails(error.message);
}

/**
 * The card generator.
 *
 * One page with four steps, a sticky preview, and a single generate action.
 * The rail is a set of jump targets. Generate reports missing information
 * rather than greying out silently.
 *
 * @source
 */
export function GeneratorShell() {
  usePageSEO("generator");

  const router = useRouter();
  const pathname = usePathname();
  const routeGenerationRef = useRef(0);
  useEffect(() => {
    routeGenerationRef.current += 1;
    return () => {
      routeGenerationRef.current += 1;
    };
  }, [pathname]);

  const draftState = useGeneratorDraft();
  const {
    draft,
    selectedIds,
    selectedCount,
    totalCardTypes,
    allSelected,
    needsGridSize,
    paletteValid,
    readyToGenerate,
    setUsername,
    applyPalette,
    setColor,
    toggleCardType,
    replaceSelection,
    addCardTypes,
    setVariation,
    toggleFavourites,
    setAllFavourites,
    toggleAnimeStatusColors,
    toggleMangaStatusColors,
    togglePiePercentages,
    toggleFrame,
    setFrameColor,
    setCornerRadius,
    setGridSize,
    rememberDraft,
  } = draftState;

  const [activeStep, setActiveStep] = useState<StepId>("username");
  const [railOpen, setRailOpen] = useState(false);
  /* Which card the preview follows. Null means "the newest selection". */
  const [focusedCard, setFocusedCard] = useState<string | null>(null);
  const [attemptedGenerate, setAttemptedGenerate] = useState(false);

  const stepRef = useRef<HTMLDivElement>(null);

  const {
    loading,
    error,
    submit,
    clearError,
    retryAttempt,
    retryLimit,
    retryOperation,
  } = useStatCardSubmit();

  const errorDetails = useMemo(() => resolveErrorDetails(error), [error]);

  /* The preview follows the newest selection unless the visitor pointed it at a
     specific card. Keeping the pointer in state rather than derived means a
     variation change on an older card does not yank the preview away. */
  const previewId = useMemo(() => {
    if (focusedCard && draft.selections[focusedCard]) return focusedCard;
    return selectedIds[selectedIds.length - 1] ?? "";
  }, [focusedCard, draft.selections, selectedIds]);

  const focusCard = useCallback((cardTypeId: string) => {
    setFocusedCard(cardTypeId);
  }, []);

  /* Selecting a card for the first time points the preview at it, so the artwork
     answers the click immediately. */
  const handleToggleCard = useCallback(
    (cardTypeId: string) => {
      const wasSelected = Boolean(draft.selections[cardTypeId]);
      toggleCardType(cardTypeId);
      if (!wasSelected) setFocusedCard(cardTypeId);
    },
    [draft.selections, toggleCardType],
  );

  const handleAddGroup = useCallback(
    (cardTypeIds: string[]) => {
      addCardTypes(cardTypeIds);
      const firstNew = cardTypeIds.find((id) => !draft.selections[id]);
      if (firstNew) setFocusedCard(firstNew);
    },
    [addCardTypes, draft.selections],
  );

  const steps = useMemo<Step[]>(() => {
    const trimmed = draft.username.trim();
    const favourites = selectedIds.filter(
      (id) => draft.selections[id]?.showFavourites,
    ).length;

    return STEP_IDS.map<Step>((id) => {
      const base = STEP_META[id];

      if (id === "username") {
        return {
          ...base,
          id,
          note: trimmed ? `Reading @${trimmed}` : "Your public AniList handle",
          count: null,
          done: trimmed.length > 0,
        };
      }

      if (id === "palette") {
        return {
          ...base,
          id,
          note: paletteValid
            ? draft.presetName === "custom"
              ? "Custom colours"
              : "Named palette or your own"
            : "Check colour values",
          count: draft.frameEnabled ? "framed" : null,
          done: paletteValid,
        };
      }

      if (id === "cards") {
        return {
          ...base,
          id,
          note:
            favourites > 0
              ? `${favourites} with favourites`
              : `${totalCardTypes} in the catalogue`,
          count: `${selectedCount}`,
          done: selectedCount > 0,
        };
      }

      return {
        ...base,
        id,
        note: readyToGenerate
          ? "Ready to generate"
          : !draft.username.trim()
            ? "Needs a username"
            : selectedCount === 0
              ? "Needs a card"
              : "Check colour values",
        count: `${selectedCount}`,
        done: readyToGenerate,
      };
    });
  }, [
    draft.username,
    draft.presetName,
    draft.frameEnabled,
    draft.selections,
    selectedIds,
    selectedCount,
    totalCardTypes,
    paletteValid,
    readyToGenerate,
  ]);

  /**
   * Generates the selected cards.
   *
   * Builds the card identifiers the store endpoint expects (`cardName` or
   * `cardName-variation`), sends everything in one submission, then moves to
   * the visitor's own page where the saved cards live.
   * @source
   */
  const handleGenerate = useCallback(async () => {
    if (loading) return;

    setAttemptedGenerate(true);

    if (!readyToGenerate) {
      setActiveStep(
        !draft.username.trim()
          ? "username"
          : selectedIds.length === 0
            ? "cards"
            : "palette",
      );
      return;
    }

    const routeGeneration = routeGenerationRef.current;

    safeTrack(() => trackButtonClick("generate_cards", "generator"));
    safeTrack(() => trackUserSearch());
    rememberDraft();

    const cardIds = selectedIds.map((id) => {
      const variation = draft.selections[id]?.variation ?? "default";
      return variation === "default" ? id : `${id}-${variation}`;
    });

    for (const id of cardIds) {
      safeTrack(() => trackCardGeneration(id));
    }

    const showFavoritesByCard = selectedIds.reduce<Record<string, boolean>>(
      (carry, id) => {
        carry[id] = Boolean(draft.selections[id]?.showFavourites);
        return carry;
      },
      {},
    );

    const result = await submit({
      username: draft.username.trim(),
      selectedCards: cardIds,
      colors: draft.colors,
      colorPreset: draft.presetName,
      showFavoritesByCard,
      showPiePercentages: draft.piePercentages,
      useAnimeStatusColors: draft.animeStatusColors,
      useMangaStatusColors: draft.mangaStatusColors,
      borderEnabled: draft.frameEnabled,
      borderColor: draft.frameColor,
      borderRadius: draft.cornerRadius,
      favoritesGrid: {
        columns: draft.gridColumns,
        rows: draft.gridRows,
      },
    });

    if (
      result.success &&
      result.userId &&
      routeGenerationRef.current === routeGeneration
    ) {
      const params = new URLSearchParams({
        userId: result.userId,
        username: draft.username.trim(),
      });
      router.push(`/user?${params.toString()}`);
    }
  }, [
    draft,
    loading,
    readyToGenerate,
    rememberDraft,
    selectedIds,
    submit,
    router,
  ]);

  /* The narrow-screen rail closes on Escape. Ctrl/Cmd+Enter preserves the
     generator shortcut when the visitor is on the final step. */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && railOpen) setRailOpen(false);
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key === "Enter" &&
        activeStep === "finish" &&
        readyToGenerate &&
        !loading
      ) {
        event.preventDefault();
        void handleGenerate();
      }
    };
    globalThis.addEventListener("keydown", onKeyDown);
    return () => globalThis.removeEventListener("keydown", onKeyDown);
  }, [activeStep, handleGenerate, loading, railOpen, readyToGenerate]);

  /* Changing step scrolls the work area back to its heading, so a jump from
     the bottom of the card list does not land mid-form. */
  const goToStep = useCallback((id: string) => {
    setActiveStep(id as StepId);
    stepRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const activeBase = STEP_META[activeStep];

  /* One bundle describes every setting the preview and the option demos need to
     render. Passing the object itself keeps those components memo-friendly. */
  const previewOptions = useMemo<PreviewOptions>(
    () => ({
      colors: draft.colors,
      frameEnabled: draft.frameEnabled,
      frameColor: draft.frameColor,
      cornerRadius: draft.cornerRadius,
      animeStatusColors: draft.animeStatusColors,
      mangaStatusColors: draft.mangaStatusColors,
      piePercentages: draft.piePercentages,
      gridColumns: draft.gridColumns,
      gridRows: draft.gridRows,
    }),
    [
      draft.colors,
      draft.frameEnabled,
      draft.frameColor,
      draft.cornerRadius,
      draft.animeStatusColors,
      draft.mangaStatusColors,
      draft.piePercentages,
      draft.gridColumns,
      draft.gridRows,
    ],
  );

  const generateLabel = loading
    ? retryAttempt > 0
      ? `Retrying (${Math.min(retryAttempt, retryLimit)}/${retryLimit})`
      : "Generating"
    : "Generate the cards";

  return (
    <ErrorBoundary>
      <PaperSurface>
        <div className={styles.masthead} inert={loading}>
          <div className={styles.sheet}>
            <p className={styles.edition}>
              <span>Card generator</span>
              <span className={styles.editionRule} aria-hidden="true" />
              <span>
                {totalCardTypes} card types · No sign-in · SVG, PNG, WebP
              </span>
            </p>

            <div className={styles.mastheadRule} />

            <div className={styles.mastheadBody}>
              <div className={styles.mastheadTitle}>
                <p className={styles.kicker}>
                  <span className={styles.kickerRule} aria-hidden="true" />
                  Reads any public AniList profile
                </p>
                <h1>
                  Your <em>cards</em>,
                  <br />
                  in four steps.
                </h1>
                <p className={styles.mastheadNote}>
                  Enter your AniList username, choose a palette, then pick the
                  cards you want. The preview shows the current card in your
                  colours, and the generate action makes the whole set at once.
                </p>
              </div>

              <button
                type="button"
                className={styles.railTrigger}
                onClick={() => setRailOpen(true)}
                aria-expanded={railOpen}
              >
                <List aria-hidden="true" />
                Steps
                <span className={styles.railCount}>
                  {selectedCount}/{totalCardTypes}
                </span>
              </button>
            </div>
          </div>
        </div>

        <div
          className={styles.sheet}
          role="group"
          aria-label="Card generator controls"
          aria-busy={loading}
          inert={loading}
        >
          <div className={styles.layout}>
            <StepRail
              steps={steps}
              activeId={activeStep}
              onSelect={goToStep}
              open={railOpen}
              onClose={() => setRailOpen(false)}
            />

            <div className={styles.work}>
              <div ref={stepRef} className={styles.step}>
                <header className={styles.stepHead}>
                  <div>
                    <h2>
                      <span className={styles.stepNumeral} aria-hidden="true">
                        {activeBase.numeral}
                      </span>
                      {activeBase.title}
                    </h2>
                    <p className={styles.stepNote}>
                      {stepNoteFor(activeStep, draft.username, selectedCount)}
                    </p>
                  </div>

                  <p className={styles.stepMeta}>
                    Step {STEP_IDS.indexOf(activeStep) + 1} of {STEP_IDS.length}
                  </p>
                </header>

                {/* Keyed by step so React swaps the element and the entrance
                    animation replays on every move between steps. */}
                <div key={activeStep} className={styles.stepBody}>
                  {activeStep === "username" && (
                    <UsernameStep
                      username={draft.username}
                      onUsernameChange={setUsername}
                    />
                  )}

                  {activeStep === "palette" && (
                    <PaletteStep
                      presetName={draft.presetName}
                      colors={draft.colors}
                      onPresetChange={applyPalette}
                      onColorChange={setColor}
                      frameEnabled={draft.frameEnabled}
                      frameColor={draft.frameColor}
                      cornerRadius={draft.cornerRadius}
                      onToggleFrame={toggleFrame}
                      onFrameColorChange={setFrameColor}
                      onCornerRadiusChange={setCornerRadius}
                    />
                  )}

                  {activeStep === "cards" && (
                    <CardsStep
                      selections={draft.selections}
                      onToggle={handleToggleCard}
                      onClearAll={() => replaceSelection([])}
                      onAddGroup={handleAddGroup}
                      onVariationChange={setVariation}
                      onToggleFavourites={toggleFavourites}
                      onFocusCard={focusCard}
                    />
                  )}

                  {activeStep === "finish" && (
                    <OptionsStep
                      selections={draft.selections}
                      selectedIds={selectedIds}
                      username={draft.username}
                      animeStatusColors={draft.animeStatusColors}
                      mangaStatusColors={draft.mangaStatusColors}
                      piePercentages={draft.piePercentages}
                      gridColumns={draft.gridColumns}
                      gridRows={draft.gridRows}
                      needsGridSize={needsGridSize}
                      options={previewOptions}
                      onToggleAnimeStatusColors={toggleAnimeStatusColors}
                      onToggleMangaStatusColors={toggleMangaStatusColors}
                      onTogglePiePercentages={togglePiePercentages}
                      onGridSizeChange={setGridSize}
                      onSetAllFavourites={setAllFavourites}
                    />
                  )}
                </div>

                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.primaryAction}
                    onClick={() => {
                      void handleGenerate();
                    }}
                    disabled={loading}
                    aria-label={`Generate ${selectedCount} card${
                      selectedCount === 1 ? "" : "s"
                    }`}
                  >
                    <Sparkles aria-hidden="true" />
                    {generateLabel}
                    <span className={styles.primaryCount} aria-hidden="true">
                      {selectedCount}
                    </span>
                  </button>

                  {activeStep !== "username" && (
                    <button
                      type="button"
                      className={styles.secondaryAction}
                      onClick={() =>
                        goToStep(STEP_IDS[STEP_IDS.indexOf(activeStep) - 1])
                      }
                    >
                      Back a step
                    </button>
                  )}

                  {activeStep !== "finish" && (
                    <button
                      type="button"
                      className={styles.secondaryAction}
                      onClick={() =>
                        goToStep(STEP_IDS[STEP_IDS.indexOf(activeStep) + 1])
                      }
                    >
                      Next step
                    </button>
                  )}

                  <p className={styles.actionNote}>
                    {attemptedGenerate && !readyToGenerate
                      ? !draft.username.trim()
                        ? "Add an AniList username, then generate again."
                        : selectedCount === 0
                          ? "Choose at least one card, then generate again."
                          : "Enter valid colours in step two before generating."
                      : describeReadiness(
                          draft.username,
                          selectedCount,
                          allSelected,
                        )}
                  </p>
                </div>
              </div>

              <PreviewPanel
                cardTypeId={previewId}
                selection={draft.selections[previewId]}
                options={previewOptions}
                selectedCount={selectedCount}
                onVariationChange={setVariation}
              />
            </div>
          </div>

          <p className={styles.footStrip}>
            <span>AniCards</span>
            <span>Reads public AniList data</span>
            <span>No account needed</span>
            <a href="/examples">See every card</a>
          </p>
        </div>

        {loading && (
          <GeneratingOverlay
            cardCount={selectedCount}
            username={draft.username}
            retryAttempt={retryAttempt}
            retryLimit={retryLimit}
            retryOperation={retryOperation}
          />
        )}

        <ErrorPopup
          isOpen={Boolean(error)}
          onClose={clearError}
          title={errorDetails?.userMessage ?? "Could not generate the cards"}
          description={
            errorDetails?.technicalMessage ??
            error?.message ??
            "Something went wrong."
          }
          suggestions={errorDetails?.suggestions}
          isRetryable={errorDetails?.retryable}
          onRetry={
            errorDetails?.retryable
              ? () => {
                  void handleGenerate();
                }
              : undefined
          }
        />
      </PaperSurface>
    </ErrorBoundary>
  );
}

/**
 * One line describing what a step is for, given the draft's state.
 * @source
 */
function stepNoteFor(
  step: StepId,
  username: string,
  selectedCount: number,
): string {
  const trimmed = username.trim();

  if (step === "username") {
    return trimmed
      ? `Public data for @${trimmed} only. AniCards never asks for a password.`
      : "The handle you use on anilist.co. No password or account access is needed.";
  }

  if (step === "palette") {
    return "Start from a named palette or set the four colours yourself. The preview updates as you go.";
  }

  if (step === "cards") {
    return selectedCount > 0
      ? `${selectedCount} chosen. Change a variation or add favourites without leaving the list.`
      : "Every card the API can render, in six groups. Add them in any order.";
  }

  return "Chart details and a last look at what will be generated.";
}

/**
 * A short readiness sentence for the action row.
 * @source
 */
function describeReadiness(
  username: string,
  selectedCount: number,
  allSelected: boolean,
): string {
  if (!username.trim()) {
    return "Start with your AniList username in step one.";
  }
  if (selectedCount === 0) {
    return "Nothing selected yet. Step three has the full list.";
  }
  if (allSelected) {
    return "Every card is selected. Generating makes all of them.";
  }
  return `Generating makes ${selectedCount} card${
    selectedCount === 1 ? "" : "s"
  } and opens them on your page.`;
}
