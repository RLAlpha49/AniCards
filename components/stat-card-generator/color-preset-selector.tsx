import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

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
}: ColorPresetSelectorProps) {
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
    <div>
      <Label htmlFor="colorPreset">Color Preset</Label>
      <Select onValueChange={onPresetChange} value={selectedPreset}>
        <SelectTrigger>
          <SelectValue placeholder="Select a color preset" />
        </SelectTrigger>
        <SelectContent>
          {sortedPresets.map(([key, { mode }]) => (
            <SelectItem key={key} value={key}>
              {`${key.charAt(0).toUpperCase() + key.slice(1)} (${
                mode === "light"
                  ? "Light Mode"
                  : mode === "dark"
                    ? "Dark Mode"
                    : "Custom"
              })`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
