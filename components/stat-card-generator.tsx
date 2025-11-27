"use client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { LoadingOverlay } from "@/components/loading-spinner";
import { ErrorPopup } from "@/components/error-popup";
import { cn } from "@/lib/utils";
import { StatCardPreview } from "@/components/stat-card-generator/stat-card-preview";
import { StatCardTypeSelection } from "@/components/stat-card-generator/stat-card-type-selection";
import { UpdateNotice } from "@/components/stat-card-generator/update-notice";
import { UserDetailsForm } from "@/components/stat-card-generator/user-details-form";
import { ColorPresetManager } from "@/components/stat-card-generator/color-preset-manager";
import { AdvancedOptions } from "@/components/stat-card-generator/advanced-options";
import { WizardNavigation } from "@/components/stat-card-generator/wizard-navigation";
import {
  GeneratorProvider,
  useGeneratorContext,
} from "@/components/stat-card-generator/generator-context";
import { statCardTypes } from "@/components/stat-card-generator/constants";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  Palette,
  LayoutGrid,
  Settings2,
  Sparkles,
  X,
  ChevronRight,
  ChevronLeft,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Props for the StatCardGenerator component.
 * @property isOpen - Whether the generator dialog is visible.
 * @property onClose - Called to request closing the dialog.
 * @property className - Optional additional CSS class names for the dialog.
 * @source
 */
interface StatCardGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

/** Steps used by the multi-stage generator wizard. Each step includes an id, label and icon. @source */
const STEPS = [
  {
    id: "user",
    label: "User",
    icon: User,
    description: "Enter your AniList username",
  },
  {
    id: "colors",
    label: "Colors",
    icon: Palette,
    description: "Choose your color theme",
  },
  {
    id: "cards",
    label: "Cards",
    icon: LayoutGrid,
    description: "Select card types",
  },
  {
    id: "advanced",
    label: "Advanced",
    icon: Settings2,
    description: "Fine-tune options",
  },
];

/**
 * Modal UI for generating and previewing stat cards.
 * Accepts a username, color settings and selected card types and submits them to the backend.
 * @param isOpen - Whether the dialog is open.
 * @param onClose - Function called to close the dialog.
 * @param className - Optional additional classes applied to the container.
 * @returns React element for the stat card generator modal.
 * @source
 */
export function StatCardGenerator({
  isOpen,
  onClose,
  className,
}: Readonly<StatCardGeneratorProps>) {
  const router = useRouter();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <GeneratorProvider router={router}>
        <GeneratorContent onClose={onClose} className={className} />
      </GeneratorProvider>
    </Dialog>
  );
}

interface GeneratorContentProps {
  readonly onClose: () => void;
  readonly className?: string;
}

function GeneratorContent({ onClose, className }: GeneratorContentProps) {
  const {
    loading,
    overlayText,
    friendlyErrorMessage,
    error,
    clearError,
    previewOpen,
    previewType,
    previewVariation,
    closePreview,
    showFavoritesByCard,
    currentStep,
    username,
    updateUsername,
    selectedCards,
    selectedCardVariants,
    allSelected,
    handleToggleCard,
    handleVariantChange,
    handleSelectAll,
    handlePreview,
    handleToggleShowFavorites,
    nextStep,
    prevStep,
    handleSubmit,
    retryStatusText,
    retryAttempt,
    retryLimit,
  } = useGeneratorContext();

  const isFirstStep = currentStep === 0;
  const isFinalStep = currentStep === STEPS.length - 1;
  const trimmedUsername = username.trim();
  const canAdvance = !(isFirstStep && trimmedUsername.length === 0);
  const canGenerate = selectedCards.length > 0 && trimmedUsername.length > 0;

  let generateButtonLabel: string | null = null;
  if (loading) {
    if (retryAttempt > 0) {
      generateButtonLabel = `Retrying (${Math.min(retryAttempt, retryLimit)}/${retryLimit})...`;
    } else {
      generateButtonLabel = "Generating...";
    }
  }

  return (
    <>
      <DialogContent
        className={cn(
          "z-50 flex h-[90vh] w-[95vw] max-w-[1100px] flex-col overflow-hidden p-0",
          "rounded-3xl border border-slate-200/50 shadow-2xl shadow-slate-900/20",
          "bg-gradient-to-br from-white/95 via-white/90 to-slate-50/95 backdrop-blur-xl",
          "dark:border-slate-700/50 dark:from-slate-900/95 dark:via-slate-900/90 dark:to-slate-800/95 dark:shadow-slate-950/50",
          className,
        )}
      >
        {loading && <LoadingOverlay text={overlayText} />}

        {/* Header Section */}
        <div className="relative z-10 shrink-0 border-b border-slate-200/50 bg-gradient-to-r from-white/80 via-white/60 to-slate-50/80 px-6 py-5 backdrop-blur-sm dark:border-slate-700/50 dark:from-slate-800/80 dark:via-slate-800/60 dark:to-slate-900/80">
          {/* Decorative gradient accent */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600" />

          <DialogHeader className="mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 shadow-lg shadow-purple-500/25">
                  <Wand2 className="h-6 w-6 text-white" />
                </div>
                <div>
                  <DialogTitle className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
                    Card Generator
                    <Sparkles className="h-5 w-5 text-purple-500" />
                  </DialogTitle>
                  <DialogDescription className="text-sm text-slate-500 dark:text-slate-400">
                    Create stunning visualizations of your AniList stats
                  </DialogDescription>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close dialog"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200/50 bg-white/80 text-slate-500 shadow-sm transition-all hover:border-slate-300 hover:bg-white hover:text-slate-700 hover:shadow-md dark:border-slate-700/50 dark:bg-slate-800/80 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </DialogHeader>

          <WizardNavigation steps={STEPS} />
        </div>

        {/* Content Section */}
        <div className="flex-1 overflow-y-auto">
          {/* Background pattern */}
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:24px_24px]" />

          <div className="relative z-10 p-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
              >
                {currentStep === 0 && (
                  <div className="space-y-6">
                    <UserDetailsForm
                      username={username}
                      onUsernameChange={updateUsername}
                    />
                    <UpdateNotice />
                  </div>
                )}

                {currentStep === 1 && <ColorPresetManager />}

                {currentStep === 2 && (
                  <StatCardTypeSelection
                    cardTypes={statCardTypes}
                    selectedCards={selectedCards}
                    selectedCardVariants={selectedCardVariants}
                    allSelected={allSelected}
                    onToggle={handleToggleCard}
                    onSelectAll={handleSelectAll}
                    onVariantChange={handleVariantChange}
                    onPreview={handlePreview}
                    showFavoritesByCard={showFavoritesByCard}
                    onToggleShowFavorites={handleToggleShowFavorites}
                  />
                )}

                {currentStep === 3 && <AdvancedOptions />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Footer Section */}
        <div className="shrink-0 border-t border-slate-200/50 bg-gradient-to-r from-white/80 via-white/60 to-slate-50/80 px-6 py-4 backdrop-blur-sm dark:border-slate-700/50 dark:from-slate-800/80 dark:via-slate-800/60 dark:to-slate-900/80">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => {
                if (currentStep === 0) {
                  onClose();
                } else {
                  prevStep();
                }
              }}
              disabled={loading}
              className="gap-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            >
              <ChevronLeft className="h-4 w-4" />
              {currentStep === 0 ? "Cancel" : "Back"}
            </Button>

            <div className="flex items-center gap-4">
              {/* Progress indicator */}
              <div className="hidden items-center gap-1.5 sm:flex">
                {STEPS.map((_, index) => (
                  <div
                    key={index}
                    className={cn(
                      "h-1.5 w-6 rounded-full transition-all duration-300",
                      index <= currentStep
                        ? "bg-gradient-to-r from-blue-500 to-purple-500"
                        : "bg-slate-200 dark:bg-slate-700",
                    )}
                  />
                ))}
              </div>

              {isFinalStep ? (
                <Button
                  onClick={handleSubmit}
                  disabled={!canGenerate || loading}
                  className="group relative h-12 min-w-[160px] overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 px-6 font-semibold text-white shadow-lg shadow-purple-500/25 transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-purple-500/30 disabled:opacity-50 disabled:hover:scale-100 disabled:hover:shadow-lg"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    {loading ? (
                      generateButtonLabel
                    ) : (
                      <>
                        Generate
                        {selectedCards.length > 0 && (
                          <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">
                            {selectedCards.length}
                          </span>
                        )}
                        <Sparkles className="h-4 w-4" />
                      </>
                    )}
                  </span>
                </Button>
              ) : (
                <Button
                  onClick={nextStep}
                  disabled={!canAdvance || loading}
                  className="h-12 min-w-[140px] rounded-xl bg-slate-900 px-6 font-semibold text-white shadow-lg transition-all hover:bg-slate-800 hover:shadow-xl disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
                >
                  <span className="flex items-center gap-2">
                    Continue
                    <ChevronRight className="h-4 w-4" />
                  </span>
                </Button>
              )}
            </div>
          </div>

          {loading && retryStatusText && (
            <motion.p
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 text-center text-xs font-medium text-amber-600 dark:text-amber-400"
            >
              {retryStatusText}
            </motion.p>
          )}
        </div>
      </DialogContent>

      <ErrorPopup
        isOpen={!!error}
        onClose={clearError}
        title="Generation Error"
        description={
          friendlyErrorMessage || error?.message || "An error occurred."
        }
      />
      <StatCardPreview
        isOpen={previewOpen}
        onClose={() => closePreview()}
        cardType={previewType}
        variation={previewVariation}
        showFavorites={showFavoritesByCard[previewType]}
      />
    </>
  );
}

export {
  colorPresets,
  statCardTypes,
} from "@/components/stat-card-generator/constants";
