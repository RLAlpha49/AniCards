import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface UserDetailsFormProps {
  username: string;
  onUsernameChange: (value: string) => void;
}

export function UserDetailsForm({
  username,
  onUsernameChange,
}: UserDetailsFormProps) {
  return (
    <div>
      <Label htmlFor="username">Username</Label>
      <Input
        id="username"
        value={username}
        onChange={(e) => onUsernameChange(e.target.value)}
        placeholder="Your Anilist username"
      />
    </div>
  );
}
