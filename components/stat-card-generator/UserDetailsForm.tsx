import { motion } from "framer-motion";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import {
  User,
  Search,
  CheckCircle2,
  ExternalLink,
  Shield,
  Zap,
} from "lucide-react";

/**
 * Props for the user details form used to enter AniList username.
 * @property username - Current username value in the input.
 * @property onUsernameChange - Callback when the username value changes.
 * @source
 */
export interface UserDetailsFormProps {
  username: string;
  onUsernameChange: (value: string) => void;
}

/**
 * Value proposition badges shown below the form.
 * @source
 */
const VALUE_PROPS = [
  { icon: Shield, text: "No login required" },
  { icon: Zap, text: "Instant generation" },
  { icon: ExternalLink, text: "Public data only" },
];

/**
 * Simple form that measures a username and displays a small inline state
 * indicating that the username is present and ready to fetch user data.
 * @param username - The current typed username.
 * @param onUsernameChange - Called when the username input changes.
 * @returns A UI form for capturing user AniList username.
 * @source
 */
export function UserDetailsForm({
  username,
  onUsernameChange,
}: Readonly<UserDetailsFormProps>) {
  const hasUsername = username.trim().length > 0;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/50 bg-gradient-to-br from-white/80 via-white/60 to-slate-50/80 shadow-xl shadow-slate-200/50 backdrop-blur-xl dark:border-slate-700/50 dark:from-slate-800/80 dark:via-slate-800/60 dark:to-slate-900/80 dark:shadow-slate-900/50">
      {/* Header */}
      <div className="border-b border-slate-200/50 bg-white/50 p-6 dark:border-slate-700/50 dark:bg-slate-800/50">
        <div className="flex items-center gap-4">
          <div className="rounded-2xl bg-gradient-to-br from-blue-500 via-blue-600 to-cyan-500 p-3.5 shadow-lg shadow-blue-500/25">
            <User className="h-6 w-6 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
              AniList Username
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Enter your username to fetch your stats
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <div className="space-y-6">
          {/* Input Field */}
          <div className="space-y-3">
            <Label
              htmlFor="username"
              className="text-sm font-semibold text-slate-700 dark:text-slate-300"
            >
              Username
            </Label>
            <div className="relative">
              <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2">
                <Search className="h-5 w-5 text-slate-400 dark:text-slate-500" />
              </div>
              <Input
                id="username"
                value={username}
                onChange={(e) => onUsernameChange(e.target.value)}
                placeholder="e.g., Alpha49"
                className="h-14 rounded-xl border-slate-200/50 bg-white pl-12 pr-32 text-lg font-medium shadow-sm transition-all placeholder:text-slate-400 hover:border-blue-300 hover:shadow-md focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700/50 dark:bg-slate-800/80 dark:placeholder:text-slate-500 dark:hover:border-blue-600 dark:focus:border-blue-500 dark:focus:ring-blue-500/20"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <motion.div
                  initial={false}
                  animate={{
                    opacity: hasUsername ? 1 : 0,
                    scale: hasUsername ? 1 : 0.8,
                  }}
                  transition={{ duration: 0.2 }}
                >
                  {hasUsername && (
                    <span className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm shadow-green-500/25">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Ready
                    </span>
                  )}
                </motion.div>
              </div>
            </div>
          </div>

          {/* Info Text */}
          <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            We&apos;ll fetch your public statistics from{" "}
            <a
              href="https://anilist.co"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-blue-600 transition-colors hover:text-blue-700 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
            >
              AniList
            </a>{" "}
            to generate your personalized stat cards.
          </p>

          {/* Value Props */}
          <div className="flex flex-wrap items-center gap-4 border-t border-slate-200/50 pt-5 dark:border-slate-700/50">
            {VALUE_PROPS.map((prop) => (
              <div
                key={prop.text}
                className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400"
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                  <prop.icon className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                </div>
                <span className="font-medium">{prop.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
