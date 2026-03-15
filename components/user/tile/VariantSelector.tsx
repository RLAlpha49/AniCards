"use client";

import { Info } from "lucide-react";
import { memo, useId } from "react";

import { Label } from "@/components/ui/Label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/Tooltip";

interface Variant {
  id: string;
  label: string;
}

interface VariantSelectorProps {
  variations?: Variant[];
  currentVariant?: string;
  onVariantChange: (variant: string) => void;
  getVariantTooltip?: (variantId: string) => string | null;
  label?: string;
  onOpenChange?: (open: boolean) => void;
}

export const VariantSelector = memo(function VariantSelector({
  variations,
  currentVariant,
  onVariantChange,
  getVariantTooltip,
  label = "Variant",
  onOpenChange,
}: Readonly<VariantSelectorProps>) {
  const triggerId = useId();

  if (!variations || variations.length <= 1) return null;

  const effectiveVariant =
    currentVariant && variations.some((v) => v.id === currentVariant)
      ? currentVariant
      : variations[0].id;

  const selectedTooltip = getVariantTooltip?.(effectiveVariant) ?? null;

  return (
    <div className="border-t border-slate-200/50 px-4 py-3 dark:border-slate-700/50">
      <div className="mb-2 flex items-center gap-2">
        <Label
          htmlFor={triggerId}
          className="block text-xs font-medium text-slate-500 dark:text-slate-400"
        >
          {label}
        </Label>
        {selectedTooltip ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                data-tour="card-variant-info"
                className="rounded-full p-0.5 text-slate-400 transition-colors hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 dark:text-slate-500 dark:hover:text-slate-300"
                aria-label={`${label} info`}
              >
                <Info className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </TooltipTrigger>
            <TooltipContent
              side="top"
              className="max-w-xs text-xs"
              sideOffset={8}
            >
              <p>{selectedTooltip}</p>
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>

      <Select
        value={effectiveVariant}
        onValueChange={onVariantChange}
        onOpenChange={onOpenChange}
      >
        <SelectTrigger
          id={triggerId}
          className="h-9 w-full text-sm"
          data-tour="card-variant"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {variations.map((variation) => (
            <SelectItem key={variation.id} value={variation.id}>
              <span
                title={getVariantTooltip?.(variation.id) ?? undefined}
                className="block"
              >
                {variation.label}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
});

VariantSelector.displayName = "VariantSelector";
