import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { trackColorPresetSelection } from "@/lib/utils/google-analytics";

export interface ColorPresetSelectorProps {
  selectedPreset: string;
  presets: {
    [key: string]: { colors: string[]; mode: string };
  };
  onPresetChange: (preset: string) => void;
}

export function ColorPresetSelector({
  selectedPreset,
  presets,
  onPresetChange,
}: Readonly<ColorPresetSelectorProps>) {
  const handlePresetChange = (preset: string) => {
    trackColorPresetSelection(preset);
    onPresetChange(preset);
  };
  const sortedPresets = Object.entries(presets).sort(
    ([aKey, aVal], [bKey, bVal]) => {
      const fixedOrder = ["default", "anilistLight", "anilistDark"];
      const aFixedIndex = fixedOrder.indexOf(aKey);
      const bFixedIndex = fixedOrder.indexOf(bKey);
      if (aFixedIndex !== -1 || bFixedIndex !== -1) {
        if (aFixedIndex !== -1 && bFixedIndex !== -1) {
          return aFixedIndex - bFixedIndex;
        }
        return aFixedIndex !== -1 ? -1 : 1;
      }
      // Always push custom to the end.
      if (aKey === "custom") return 1;
      if (bKey === "custom") return -1;
      // If both presets have the same mode, maintain current order.
      if (aVal.mode === bVal.mode) return 0;
      // Light mode presets come first.
      return aVal.mode === "light" ? -1 : 1;
    },
  );

  return (
    <div className="space-y-3">
      <Label
        htmlFor="colorPreset"
        className="text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        Color Preset ✨
      </Label>
      <Select onValueChange={handlePresetChange} value={selectedPreset}>
        <SelectTrigger className="border-purple-200/50 bg-white transition-all duration-200 hover:border-purple-300 focus:border-purple-400 dark:border-purple-700/50 dark:bg-gray-800 dark:hover:border-purple-600 dark:focus:border-purple-500">
          <SelectValue placeholder="Select a color preset" />
        </SelectTrigger>
        <SelectContent className="border-purple-200/50 bg-white dark:border-purple-700/50 dark:bg-gray-800">
          {sortedPresets.map(([key, { mode }]) => {
            let modeLabel = "Custom";
            let icon = "🎨";
            if (mode === "light") {
              modeLabel = "Light Mode";
              icon = "☀️";
            } else if (mode === "dark") {
              modeLabel = "Dark Mode";
              icon = "🌙";
            }
            return (
              <SelectItem
                key={key}
                value={key}
                className="transition-colors duration-200 hover:bg-purple-50/70 focus:bg-purple-100/70 dark:hover:bg-purple-900/30 dark:focus:bg-purple-900/50"
              >
                <span className="flex items-center gap-2">
                  {icon}
                  {`${key.charAt(0).toUpperCase() + key.slice(1)} (${modeLabel})`}
                </span>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}
