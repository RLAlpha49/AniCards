import { Input } from "@/components/ui/Input";
import { motion } from "framer-motion";
import { User, Check, AtSign } from "lucide-react";

/**
 * Props for the DefaultUsernameSettings component.
 * @property defaultUsername - The username value to pre-fill in forms.
 * @property onUsernameChange - Callback invoked when username input changes.
 * @source
 */
interface DefaultUsernameSettingsProps {
  defaultUsername: string;
  onUsernameChange: (value: string) => void;
}

/**
 * UI component for configuring a default AniList username.
 * This value is used to pre-fill any forms that require an AniList username.
 * @param defaultUsername - Current configured default username.
 * @param onUsernameChange - Called with the updated username string.
 * @returns A React element for the default username settings.
 * @source
 */
export function DefaultUsernameSettings({
  defaultUsername,
  onUsernameChange,
}: Readonly<DefaultUsernameSettingsProps>) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: 0.1 }}
    >
      <div className="overflow-hidden rounded-3xl border border-slate-200/50 bg-gradient-to-br from-white/80 via-white/60 to-slate-100/80 shadow-xl shadow-slate-200/50 backdrop-blur-xl dark:border-slate-700/50 dark:from-slate-800/80 dark:via-slate-800/60 dark:to-slate-900/80 dark:shadow-slate-900/50">
        {/* Header */}
        <div className="border-b border-slate-200/50 bg-white/50 p-6 dark:border-slate-700/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-4">
            <div className="rounded-2xl bg-gradient-to-br from-purple-500 via-pink-500 to-rose-500 p-3.5 shadow-lg shadow-pink-500/25">
              <User className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                Default Username
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Set your default AniList username to pre-fill forms
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="space-y-4">
            {/* Input container */}
            <div className="relative">
              <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2">
                <AtSign className="h-5 w-5 text-slate-400" />
              </div>
              <Input
                id="default-username"
                className="h-14 rounded-xl border-slate-200 bg-white/80 pl-12 pr-12 text-lg shadow-sm transition-all placeholder:text-slate-400 hover:border-purple-300 focus:border-purple-500 focus:bg-white focus:shadow-md focus:shadow-purple-500/10 focus:ring-2 focus:ring-purple-500/20 dark:border-slate-700 dark:bg-slate-800/80 dark:placeholder:text-slate-500 dark:hover:border-purple-700 dark:focus:border-purple-500 dark:focus:bg-slate-800 dark:focus:shadow-purple-500/10"
                value={defaultUsername}
                onChange={(e) => onUsernameChange(e.target.value)}
                placeholder="Enter your AniList username"
              />
              {/* Success indicator */}
              {defaultUsername && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="absolute right-4 top-1/2 -translate-y-1/2"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg shadow-green-500/30">
                    <Check className="h-4 w-4 text-white" strokeWidth={3} />
                  </div>
                </motion.div>
              )}
            </div>

            {/* Info text */}
            <div className="flex items-start gap-3 rounded-xl border border-blue-200/50 bg-blue-50/50 p-4 dark:border-blue-800/50 dark:bg-blue-900/20">
              <div className="mt-0.5 flex-shrink-0 rounded-lg bg-blue-100 p-1.5 dark:bg-blue-900/50">
                <svg
                  className="h-4 w-4 text-blue-600 dark:text-blue-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                This username will be automatically filled when generating new
                stat cards, saving you time on every card creation.
              </p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
