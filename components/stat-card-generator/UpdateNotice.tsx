import { motion } from "framer-motion";
import { Info, RefreshCw, Clock, Trash2 } from "lucide-react";

/**
 * Presentational alert describing how to force-refresh or clear cached SVGs.
 * Useful for debugging when the generated graphic does not update immediately.
 * @returns An Alert element that outlines refresh instructions.
 * @source
 */
export function UpdateNotice() {
  const steps = [
    {
      icon: RefreshCw,
      title: "Hard Refresh",
      description: (
        <span className="flex flex-wrap items-center gap-1">
          Press{" "}
          <kbd className="rounded-md border border-blue-200 bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold text-blue-700 shadow-sm dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300">
            Ctrl
          </kbd>
          <span className="text-blue-400">+</span>
          <kbd className="rounded-md border border-blue-200 bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold text-blue-700 shadow-sm dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300">
            F5
          </kbd>
          <span className="mx-1 text-blue-400">or</span>
          <kbd className="rounded-md border border-blue-200 bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold text-blue-700 shadow-sm dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300">
            Cmd
          </kbd>
          <span className="text-blue-400">+</span>
          <kbd className="rounded-md border border-blue-200 bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold text-blue-700 shadow-sm dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300">
            Shift
          </kbd>
          <span className="text-blue-400">+</span>
          <kbd className="rounded-md border border-blue-200 bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold text-blue-700 shadow-sm dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300">
            R
          </kbd>
        </span>
      ),
    },
    {
      icon: Trash2,
      title: "Clear Cache",
      description: "Clear your browser cache manually",
    },
    {
      icon: Clock,
      title: "Wait",
      description: "Cache expires automatically after 24h",
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="overflow-hidden rounded-2xl border border-blue-200/50 bg-gradient-to-br from-blue-50/80 via-blue-50/60 to-cyan-50/80 shadow-lg shadow-blue-100/50 dark:border-blue-800/30 dark:from-blue-950/40 dark:via-blue-950/30 dark:to-cyan-950/40 dark:shadow-blue-950/50"
    >
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-blue-200/50 bg-blue-50/50 px-5 py-4 dark:border-blue-800/30 dark:bg-blue-950/30">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 shadow-md shadow-blue-500/25">
          <Info className="h-4.5 w-4.5 text-white" />
        </div>
        <div>
          <h4 className="font-bold text-blue-900 dark:text-blue-100">
            Cache Notice
          </h4>
          <p className="text-xs text-blue-600 dark:text-blue-400">
            SVG cards are cached for 24 hours
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        <p className="mb-4 text-sm text-blue-700 dark:text-blue-300">
          If your changes don&apos;t appear immediately, try one of these
          options:
        </p>

        <div className="grid gap-3 sm:grid-cols-3">
          {steps.map((step, index) => (
            <div
              key={step.title}
              className="flex items-start gap-3 rounded-xl border border-blue-200/30 bg-white/60 p-3 backdrop-blur-sm dark:border-blue-800/20 dark:bg-blue-950/30"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/50">
                <step.icon className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[9px] font-bold text-white">
                    {index + 1}
                  </span>
                  <span className="text-xs font-semibold text-blue-900 dark:text-blue-100">
                    {step.title}
                  </span>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-blue-600 dark:text-blue-400">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
