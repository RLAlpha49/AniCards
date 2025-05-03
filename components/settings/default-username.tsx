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
}: DefaultUsernameSettingsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="space-y-4"
    >
      <Label htmlFor="default-username" className="text-lg font-medium">
        Default Username
      </Label>
      <Input
        id="default-username"
        className="bg-accent/40"
        value={defaultUsername}
        onChange={(e) => onUsernameChange(e.target.value)}
        placeholder="Enter your default username"
      />
    </motion.div>
  );
}
