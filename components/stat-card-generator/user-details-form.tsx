import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface UserDetailsFormProps {
  username: string;
  onUsernameChange: (value: string) => void;
}

export function UserDetailsForm({
  username,
  onUsernameChange,
}: Readonly<UserDetailsFormProps>) {
  return (
    <div className="space-y-3">
      <Label
        htmlFor="username"
        className="text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        AniList Username 👤
      </Label>
      <Input
        id="username"
        value={username}
        onChange={(e) => onUsernameChange(e.target.value)}
        placeholder="Enter your AniList username"
        className="border-blue-200/50 bg-white/70 backdrop-blur-sm transition-all duration-200 placeholder:text-gray-400 hover:border-blue-300 focus:border-blue-400 dark:border-blue-700/50 dark:bg-gray-800/70 dark:placeholder:text-gray-500 dark:hover:border-blue-600 dark:focus:border-blue-500"
      />
      <p className="text-xs text-gray-500 dark:text-gray-400">
        We&apos;ll fetch your statistics from AniList to generate personalized
        cards
      </p>
    </div>
  );
}
