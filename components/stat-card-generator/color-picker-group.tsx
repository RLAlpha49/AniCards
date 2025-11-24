import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
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

export function ColorPickerGroup({ pickers }: Readonly<ColorPickerGroupProps>) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4">
      {pickers.map((picker) => {
        const valid = isValidHex(picker.value);
        return (
          <div key={picker.id} className="space-y-2">
            <Label
              htmlFor={picker.id}
              className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
            >
              {picker.label}
            </Label>
            <div className="group relative flex items-center gap-2">
              <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-gray-200 shadow-sm transition-all group-hover:scale-105 dark:border-gray-700">
                <Input
                  id={picker.id}
                  type="color"
                  value={valid ? picker.value : "#000000"}
                  onChange={(e) => picker.onChange(e.target.value)}
                  className="absolute -left-1/2 -top-1/2 h-[200%] w-[200%] cursor-pointer border-0 p-0"
                  aria-label={`${picker.label} color picker`}
                />
              </div>
              <div className="relative flex-grow">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-400">
                  #
                </span>
                <Input
                  type="text"
                  value={picker.value.replace("#", "")}
                  onChange={(e) => {
                    const val = e.target.value;
                    // Allow user to type without #, add it back for the callback
                    picker.onChange(val.startsWith("#") ? val : `#${val}`);
                  }}
                  className={cn(
                    "min-w-0 pl-7 font-mono text-sm uppercase transition-all",
                    valid
                      ? "border-gray-200 focus-visible:ring-blue-500 dark:border-gray-700"
                      : "border-red-500 focus-visible:ring-red-500",
                  )}
                  maxLength={7}
                  aria-label={`${picker.label} color hex code input`}
                  placeholder="000000"
                />
              </div>
            </div>
            {!valid && (
              <p className="text-[10px] text-red-500 animate-in slide-in-from-top-1">
                Invalid hex code
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
