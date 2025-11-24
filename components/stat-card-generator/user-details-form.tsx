import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Search } from "lucide-react";

export interface UserDetailsFormProps {
  username: string;
  onUsernameChange: (value: string) => void;
}

export function UserDetailsForm({
  username,
  onUsernameChange,
}: Readonly<UserDetailsFormProps>) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label
          htmlFor="username"
          className="text-base font-semibold text-gray-900 dark:text-gray-100"
        >
          AniList Username
        </Label>
        <div className="relative">
          <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">
            <User className="h-5 w-5" />
          </div>
          <Input
            id="username"
            value={username}
            onChange={(e) => onUsernameChange(e.target.value)}
            placeholder="Enter your username..."
            className="h-12 border-gray-200 bg-white pl-10 text-lg transition-all hover:border-blue-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-500 dark:focus:border-blue-400"
          />
          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
            {username && (
              <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                <Search className="h-3 w-3" />
                Ready to fetch
              </span>
            )}
          </div>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        We&apos;ll fetch your public statistics from AniList to generate your
        personalized cards. No login required.
      </p>
    </div>
  );
}
