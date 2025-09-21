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
      <div className="rounded-xl border border-white/20 bg-white/10 p-6 backdrop-blur-sm dark:border-gray-700/30 dark:bg-gray-700/20">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 p-2">
            <svg
              className="h-5 w-5 text-white"
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
              className="text-xl font-semibold text-gray-900 dark:text-white"
            >
              Default Username
            </Label>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Set your default AniList username to pre-fill forms
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Input
            id="default-username"
            className="border-white/20 bg-white/20 backdrop-blur-sm transition-all duration-200 hover:border-white/30 hover:bg-white/25 focus:border-blue-400 focus:bg-white/30 dark:border-gray-600/30 dark:bg-gray-700/20 dark:hover:border-gray-600/40 dark:hover:bg-gray-700/30 dark:focus:border-blue-400"
            value={defaultUsername}
            onChange={(e) => onUsernameChange(e.target.value)}
            placeholder="Enter your AniList username"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            This username will be automatically filled when generating new stat
            cards
          </p>
        </div>
      </div>
    </motion.div>
  );
}
