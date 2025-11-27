"use client";

import { Fragment } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useGeneratorContext } from "./generator-context";
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

export function WizardNavigation({ steps }: Readonly<WizardNavigationProps>) {
  const { currentStep, goToStep } = useGeneratorContext();

  return (
    <div className="relative">
      {/* Mobile View - Simple Progress Bar */}
      <div className="flex items-center gap-3 sm:hidden">
        <span className="text-sm font-semibold text-slate-900 dark:text-white">
          Step {currentStep + 1} of {steps.length}
        </span>
        <div className="flex flex-1 gap-1">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-all duration-300",
                index <= currentStep
                  ? "bg-gradient-to-r from-blue-500 to-purple-500"
                  : "bg-slate-200 dark:bg-slate-700",
              )}
            />
          ))}
        </div>
      </div>

      {/* Desktop View - Full Stepper */}
      <div className="hidden sm:block">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isActive = index === currentStep;
            const isCompleted = index < currentStep;

            return (
              <Fragment key={step.id}>
                {/* Connector Line */}
                {index > 0 && (
                  <div className="relative mx-2 h-0.5 flex-1">
                    <div className="absolute inset-0 -translate-y-3 rounded-full bg-slate-200 dark:bg-slate-700" />
                    <motion.div
                      initial={false}
                      animate={{
                        width: index <= currentStep ? "100%" : "0%",
                      }}
                      transition={{ duration: 0.4, ease: "easeInOut" }}
                      className="absolute inset-y-0 left-0 -translate-y-3 rounded-full bg-gradient-to-r from-blue-500 to-purple-500"
                    />
                  </div>
                )}

                {/* Step Button */}
                <button
                  type="button"
                  onClick={() => goToStep(index)}
                  className="group relative flex cursor-pointer flex-col items-center gap-2 transition-all"
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
                      <Check className="h-5 w-5 text-white" />
                    ) : (
                      <Icon
                        className={cn(
                          "h-5 w-5 transition-colors",
                          isActive && "text-white",
                          !isActive &&
                            !isCompleted &&
                            "text-slate-400 dark:text-slate-500",
                        )}
                      />
                    )}
                  </motion.div>

                  {/* Step Label */}
                  <span
                    className={cn(
                      "text-xs font-semibold transition-colors",
                      isActive && "text-slate-900 dark:text-white",
                      isCompleted && "text-green-600 dark:text-green-400",
                      !isActive &&
                        !isCompleted &&
                        "text-slate-400 dark:text-slate-500",
                    )}
                  >
                    {step.label}
                  </span>
                </button>
              </Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}
