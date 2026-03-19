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
    <div className="border-gold/15 dark:border-gold/10 border-t-2 px-4 py-3">
      <div className="mb-2 flex items-center gap-2">
        <Label
          htmlFor={triggerId}
          className="font-display text-muted-foreground block text-[10px] tracking-[0.15em] uppercase"
        >
          {label}
        </Label>
        {selectedTooltip ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                data-tour="card-variant-info"
                className="text-muted-foreground hover:text-foreground focus-visible:ring-gold/50 rounded-full p-0.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
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
          className="border-gold/20 focus:ring-gold/30 dark:border-gold/15 h-9 w-full text-sm"
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
