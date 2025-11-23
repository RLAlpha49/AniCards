import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";

interface DefaultUsernameSettingsProps {
  defaultUsername: string;
  onUsernameChange: (value: string) => void;
}

export function DefaultUsernameSettings({
  defaultUsername,
  onUsernameChange,
}: Readonly<DefaultUsernameSettingsProps>) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.25 }}
      className="space-y-4"
    >
      <div className="rounded-2xl border border-white/50 bg-white/80 p-6 shadow-xl backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/80">
        <div className="mb-6 flex items-center gap-4">
          <div className="rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 p-3 shadow-lg shadow-purple-500/20">
            <svg
              className="h-6 w-6 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
          </div>
          <div>
            <Label
              htmlFor="default-username"
              className="text-xl font-bold text-slate-900 dark:text-white"
            >
              Default Username
            </Label>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Set your default AniList username to pre-fill forms
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="relative">
            <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
            <Input
              id="default-username"
              className="h-14 border-slate-200 bg-slate-50 pl-12 text-lg transition-all hover:border-blue-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800/50 dark:hover:border-blue-500 dark:focus:border-blue-400 dark:focus:bg-slate-800"
              value={defaultUsername}
              onChange={(e) => onUsernameChange(e.target.value)}
              placeholder="Enter your AniList username"
            />
            {defaultUsername && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-green-500">
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            This username will be automatically filled when generating new stat
            cards
          </p>
        </div>
      </div>
    </motion.div>
  );
}
