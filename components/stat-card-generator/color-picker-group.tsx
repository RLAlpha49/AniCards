import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import React from "react";

export interface ColorPickerItem {
  id: string;
  label: string;
  value: string;
  onChange: (newValue: string) => void;
}

interface ColorPickerGroupProps {
  pickers: ColorPickerItem[];
}

// A simple hex color validator.
function isValidHex(color: string): boolean {
  return /^#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$/.test(color);
}

export function ColorPickerGroup({ pickers }: ColorPickerGroupProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {pickers.map((picker) => {
        const valid = isValidHex(picker.value);
        return (
          <div key={picker.id} className="space-y-2">
            <Label htmlFor={picker.id}>{picker.label} Color</Label>
            <div className="flex items-center space-x-2">
              {/* Use a fallback value for the color picker if the hex is invalid */}
              <Input
                id={picker.id}
                type="color"
                value={valid ? picker.value : "#000000"}
                onChange={(e) => picker.onChange(e.target.value)}
                className="h-12 w-12 transform-gpu cursor-pointer rounded p-1 transition-transform duration-200 hover:scale-105"
                style={!valid ? { border: "2px solid red" } : {}}
                aria-label={`${picker.label} color picker`}
              />
              <Input
                type="text"
                value={picker.value}
                onChange={(e) => picker.onChange(e.target.value)}
                className={`flex-grow transition-all duration-200 focus:ring-2 focus:ring-primary ${
                  !valid ? "border-red-500" : ""
                }`}
                aria-label={`${picker.label} color hex code input`}
                placeholder="#000000"
              />
            </div>
            {!valid && (
              <p className="text-xs text-red-500">
                Invalid hex color. Please enter a valid hex code.
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
