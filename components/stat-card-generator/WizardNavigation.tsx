"use client";

import { Fragment, useCallback } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useGeneratorContext } from "./GeneratorContext";
import type { LucideIcon } from "lucide-react";
import { Check } from "lucide-react";

export type WizardStep = {
  id: string;
  label: string;
  icon: LucideIcon;
  description?: string;
};

export interface WizardNavigationProps {
  steps: WizardStep[];
}

function getStepStatus(index: number, currentStep: number): string {
  if (index < currentStep) return "Completed";
  if (index === currentStep) return "Current step";
  return "Not started";
}

function buildStepAriaLabel(
  step: WizardStep,
  index: number,
  currentStep: number,
): string {
  const status = getStepStatus(index, currentStep);
  const description = step.description ? `. ${step.description}` : "";
  return `${step.label}. ${status}${description}`;
}

function StepButton({
  step,
  index,
  isActive,
  isCompleted,
  onNavigate,
  onKeyDown,
}: Readonly<{
  step: WizardStep;
  index: number;
  isActive: boolean;
  isCompleted: boolean;
  onNavigate: (index: number) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLButtonElement>, idx: number) => void;
}>) {
  const Icon = step.icon;
  const ariaLabel = buildStepAriaLabel(step, index, index);

  return (
    <button
      type="button"
      onClick={() => onNavigate(index)}
      onKeyDown={(e) => onKeyDown(e, index)}
      role="tab"
      aria-selected={isActive}
      aria-label={ariaLabel}
      title={`Step ${index + 1}: ${step.label}. Use arrow keys to navigate between steps.`}
      tabIndex={isActive ? 0 : -1}
      className={cn(
        "group relative flex cursor-pointer flex-col items-center gap-2 transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500",
        "rounded-lg p-1",
      )}
    >
      {/* Step Circle */}
      <motion.div
        initial={false}
        animate={{
          scale: isActive ? 1.1 : 1,
        }}
        className={cn(
          "relative flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-300",
          isActive && [
            "border-transparent bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500",
            "shadow-lg shadow-purple-500/30",
          ],
          isCompleted && [
            "border-transparent bg-gradient-to-br from-green-500 to-emerald-500",
            "shadow-md shadow-green-500/25",
          ],
          !isActive &&
            !isCompleted && [
              "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800",
              "group-hover:border-slate-300 group-hover:shadow-md dark:group-hover:border-slate-600",
            ],
        )}
      >
        {isCompleted ? (
          <Check className="h-5 w-5 text-white" aria-hidden="true" />
        ) : (
          <Icon
            className={cn(
              "h-5 w-5 transition-colors",
              isActive && "text-white",
              !isActive && !isCompleted && "text-slate-400 dark:text-slate-500",
            )}
            aria-hidden="true"
          />
        )}
      </motion.div>

      {/* Step Label */}
      <span
        className={cn(
          "text-xs font-semibold transition-colors",
          isActive && "text-slate-900 dark:text-white",
          isCompleted && "text-green-600 dark:text-green-400",
          !isActive && !isCompleted && "text-slate-400 dark:text-slate-500",
        )}
      >
        {step.label}
      </span>
    </button>
  );
}

function ConnectorLine({
  index,
  currentStep,
}: Readonly<{ index: number; currentStep: number }>) {
  if (index === 0) return null;

  return (
    <div className="relative mx-2 h-0.5 flex-1">
      <div
        className="absolute inset-0 -translate-y-3 rounded-full bg-slate-200 dark:bg-slate-700"
        aria-hidden="true"
      />
      <motion.div
        initial={false}
        animate={{
          width: index <= currentStep ? "100%" : "0%",
        }}
        transition={{ duration: 0.4, ease: "easeInOut" }}
        className="absolute inset-y-0 left-0 -translate-y-3 rounded-full bg-gradient-to-r from-blue-500 to-purple-500"
        aria-hidden="true"
      />
    </div>
  );
}

export function WizardNavigation({ steps }: Readonly<WizardNavigationProps>) {
  const { currentStep, goToStep } = useGeneratorContext();

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>, stepIndex: number) => {
      if (e.key === "ArrowLeft" && stepIndex > 0) {
        goToStep(stepIndex - 1);
        e.preventDefault();
      } else if (e.key === "ArrowRight" && stepIndex < steps.length - 1) {
        goToStep(stepIndex + 1);
        e.preventDefault();
      } else if (e.key === "Home") {
        goToStep(0);
        e.preventDefault();
      } else if (e.key === "End") {
        goToStep(steps.length - 1);
        e.preventDefault();
      }
    },
    [goToStep, steps.length],
  );

  return (
    <nav className="relative" aria-label="Wizard steps">
      {/* Mobile View - Simple Progress Bar */}
      <div className="flex items-center gap-3 sm:hidden">
        <span
          className="text-sm font-semibold text-slate-900 dark:text-white"
          aria-live="polite"
          aria-atomic="true"
        >
          Step {currentStep + 1} of {steps.length}: {steps[currentStep]?.label}
        </span>
        <div
          className="flex flex-1 gap-1"
          aria-valuenow={currentStep + 1}
          aria-valuemin={1}
          aria-valuemax={steps.length}
          aria-label={`Progress: step ${currentStep + 1} of ${steps.length}`}
        >
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-all duration-300",
                index <= currentStep
                  ? "bg-gradient-to-r from-blue-500 to-purple-500"
                  : "bg-slate-200 dark:bg-slate-700",
              )}
              aria-hidden="true"
            />
          ))}
        </div>
      </div>

      {/* Desktop View - Full Stepper */}
      <div className="hidden sm:block">
        <div
          className="flex items-center justify-between"
          role="tablist"
          aria-label="Wizard step navigation"
        >
          {steps.map((step, index) => {
            const isActive = index === currentStep;
            const isCompleted = index < currentStep;

            return (
              <Fragment key={step.id}>
                <ConnectorLine index={index} currentStep={currentStep} />
                <StepButton
                  step={step}
                  index={index}
                  isActive={isActive}
                  isCompleted={isCompleted}
                  onNavigate={goToStep}
                  onKeyDown={handleKeyDown}
                />
              </Fragment>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
