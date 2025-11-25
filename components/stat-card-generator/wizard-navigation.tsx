"use client";

import { Fragment } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useGeneratorContext } from "./generator-context";
import type { LucideIcon } from "lucide-react";
import { CheckCircle2 } from "lucide-react";

export type WizardStep = {
  id: string;
  label: string;
  icon: LucideIcon;
};

export interface WizardNavigationProps {
  steps: WizardStep[];
}

export function WizardNavigation({ steps }: Readonly<WizardNavigationProps>) {
  const { currentStep, goToStep } = useGeneratorContext();

  // Only render step indicator bubbles; footer contains actions

  return (
    <div className="relative z-10 flex w-full flex-col bg-white px-2 py-3 dark:bg-gray-900">
      <motion.div
        key={`wizard-${currentStep}`}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="flex w-full items-center justify-between gap-0"
      >
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isActive = index === currentStep;
          const isCompleted = index < currentStep;

          let buttonClass =
            "relative flex h-10 w-10 items-center justify-center rounded-full transition-all duration-300";
          if (isActive) {
            buttonClass +=
              " bg-blue-600 text-white shadow-lg shadow-blue-500/30 scale-110";
          } else if (isCompleted) {
            buttonClass += " bg-green-500 text-white";
          } else {
            buttonClass += " bg-gray-100 text-gray-400 dark:bg-gray-800";
          }

          let textClass = "text-xs font-medium transition-colors";
          if (isActive) {
            textClass += " text-blue-600 dark:text-blue-400";
          } else if (isCompleted) {
            textClass += " text-green-600 dark:text-green-400";
          } else {
            textClass += " text-gray-400";
          }

          return (
            <Fragment key={step.id}>
              {index > 0 && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "block h-[2px] min-w-[32px] max-w-[230px] flex-1 -translate-y-2.5 self-center transition-colors duration-300",
                    index <= currentStep
                      ? "bg-green-500"
                      : "bg-gray-100 dark:bg-gray-800",
                  )}
                />
              )}

              <div className="flex flex-col items-center gap-2 px-3">
                <button
                  type="button"
                  onClick={() => goToStep(index)}
                  className={buttonClass}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                </button>
                <span className={textClass}>{step.label}</span>
              </div>
            </Fragment>
          );
        })}
      </motion.div>

      {/* Actions relocated to the footer */}
    </div>
  );
}
