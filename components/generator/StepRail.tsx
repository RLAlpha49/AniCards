"use client";

import { Check, List, X } from "@/lib/icons";
import { cn } from "@/lib/utils";
import styles from "./generator.module.css";

/** One step the generator walks through. @source */
export type Step = Readonly<{
  id: string;
  label: string;
  numeral: string;
  note: string;
  /** Short count shown beside the label, or `null` when there is nothing to count. */
  count: string | null;
  done: boolean;
}>;

type StepRailProps = Readonly<{
  steps: Step[];
  activeId: string;
  onSelect: (id: string) => void;
  /** True while the narrow-screen sheet is open. */
  open: boolean;
  onClose: () => void;
}>;

/** How many steps are finished, for the progress meter. @source */
function completedCount(steps: Step[]): number {
  return steps.filter((step) => step.done).length;
}

/**
 * Step rail.
 *
 * Lists the four steps with a live count of what each holds, so progress is
 * legible without stepping through anything. A step is a jump target rather
 * than a gate, so a visitor can start at the palette and come back to the name.
 *
 * Below 960px the rail becomes a sheet opened by a trigger in the masthead.
 *
 * @source
 */
export function StepRail({
  steps,
  activeId,
  onSelect,
  open,
  onClose,
}: StepRailProps) {
  const done = completedCount(steps);

  return (
    <>
      {open && (
        <button
          type="button"
          className={styles.railBackdrop}
          aria-label="Close the step list"
          onClick={onClose}
        />
      )}

      <nav
        className={cn(styles.rail, open && styles.railOpen)}
        aria-label="Generator steps"
      >
        <p className={styles.railHead}>
          <List aria-hidden="true" width={12} height={12} />
          <span>Steps</span>
          <span className={styles.railHeadRule} aria-hidden="true" />
          <button
            type="button"
            className={styles.railClose}
            onClick={onClose}
            aria-label="Close the step list"
          >
            <X width={14} height={14} aria-hidden="true" />
          </button>
        </p>

        <ol className={styles.railList}>
          {steps.map((step) => {
            const active = step.id === activeId;

            return (
              <li key={step.id}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(step.id);
                    onClose();
                  }}
                  aria-current={active ? "step" : undefined}
                  className={cn(
                    styles.railItem,
                    active && styles.railItemActive,
                  )}
                >
                  <span className={styles.railNumeral} aria-hidden="true">
                    {step.numeral}
                  </span>
                  <span className={styles.railLabel}>
                    {step.label}
                    {step.count !== null && (
                      <span
                        className={cn(
                          styles.railCount,
                          step.done && styles.railCountSet,
                        )}
                      >
                        {step.count}
                      </span>
                    )}
                  </span>
                  <span className={styles.railNote}>
                    {step.done ? (
                      <span className={styles.railDone}>
                        <Check aria-hidden="true" />
                        {step.note}
                      </span>
                    ) : (
                      step.note
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        <div className={styles.railFoot}>
          <p>
            {done} of {steps.length} done
          </p>
          <div className={styles.railMeter} aria-hidden="true">
            {steps.map((step) => (
              <span
                key={step.id}
                className={cn(
                  styles.railMeterStep,
                  step.done && styles.railMeterStepDone,
                )}
              />
            ))}
          </div>
        </div>
      </nav>
    </>
  );
}
