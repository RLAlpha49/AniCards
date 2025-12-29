"use client";

import { Label } from "@/components/ui/Label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";

interface Variant {
  id: string;
  label: string;
}

interface VariantSelectorProps {
  variations?: Variant[];
  currentVariant?: string;
  onVariantChange: (variant: string) => void;
}

export function VariantSelector({
  variations,
  currentVariant,
  onVariantChange,
}: Readonly<VariantSelectorProps>) {
  if (!variations || variations.length <= 1) return null;

  const effectiveVariant = currentVariant && variations.some(v => v.id === currentVariant) ? currentVariant : variations[0].id;

  return (
    <div className="border-t border-slate-200/50 px-4 py-3 dark:border-slate-700/50">
      <Label className="mb-2 block text-xs font-medium text-slate-500 dark:text-slate-400">
        Variant
      </Label>
      <Select value={effectiveVariant} onValueChange={onVariantChange}>
        <SelectTrigger className="h-9 w-full text-sm">
          <SelectValue placeholder="Select variant" />
        </SelectTrigger>
        <SelectContent>
          {variations.map((variation) => (
            <SelectItem key={variation.id} value={variation.id}>
              {variation.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
