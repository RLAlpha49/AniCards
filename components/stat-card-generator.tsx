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
  { id: "user", label: "User", icon: User },
  { id: "colors", label: "Colors", icon: Palette },
  { id: "cards", label: "Cards", icon: LayoutGrid },
  { id: "advanced", label: "Advanced", icon: Settings2 },
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
      generateButtonLabel = "Generating cards...";
    }
  }

  return (
    <>
      <DialogContent
        className={cn(
          "z-50 flex h-[90vh] max-h-[1000px] w-[95vw] max-w-[1000px] flex-col overflow-hidden p-0",
          "bg-white dark:bg-gray-900",
          "rounded-2xl border-0 shadow-2xl",
          className,
        )}
      >
        {loading && <LoadingOverlay text={overlayText} />}
        <div className="relative z-10 flex shrink-0 flex-col border-b border-gray-100 bg-white px-6 py-4 dark:border-gray-800 dark:bg-gray-900">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl font-bold">
              <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                Generate Cards
              </span>
              <Sparkles className="h-5 w-5 text-purple-500" />
            </DialogTitle>
            <DialogDescription className="text-gray-500 dark:text-gray-400">
              Create beautiful, personalized visualizations of your AniList
              stats.
            </DialogDescription>
          </DialogHeader>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-transparent bg-gray-100 text-gray-500 transition hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <X className="h-4 w-4" />
          </button>

          <WizardNavigation steps={STEPS} />
        </div>

        <div className="flex-1 overflow-y-auto bg-gray-50/50 p-2 dark:bg-gray-900/50">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="mx-auto max-w-4xl"
            >
              {currentStep === 0 && (
                <div className="space-y-6">
                  <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                    <UserDetailsForm
                      username={username}
                      onUsernameChange={updateUsername}
                    />
                  </div>
                  <UpdateNotice />
                </div>
              )}

              {currentStep === 1 && <ColorPresetManager />}

              {currentStep === 2 && (
                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
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
                </div>
              )}

              {currentStep === 3 && (
                <div className="space-y-6">
                  <AdvancedOptions />
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
        {/* Footer Actions */}
        <div className="flex shrink-0 flex-col gap-2 border-t border-gray-100 bg-white px-6 py-4 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex w-full items-center justify-between">
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
              className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
            >
              Back
            </Button>

            <div className="flex items-center gap-3">
              {isFinalStep ? (
                <Button
                  onClick={handleSubmit}
                  disabled={!canGenerate || loading}
                  className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 px-8 font-semibold text-white shadow-lg transition-all hover:scale-105 hover:shadow-xl disabled:opacity-50"
                >
                  {loading ? (
                    generateButtonLabel
                  ) : (
                    <>
                      Generate
                      {selectedCards.length > 0 && ` (${selectedCards.length})`}
                      <Sparkles className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  onClick={nextStep}
                  disabled={!canAdvance || loading}
                  className="bg-gray-900 text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
                >
                  Next Step
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          {loading && retryStatusText && (
            <p className="text-xs text-yellow-600 dark:text-yellow-300">
              {retryStatusText}
            </p>
          )}
        </div>
      </DialogContent>

      <ErrorPopup
        isOpen={!!error}
        onClose={clearError}
        title="Submission Error"
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
