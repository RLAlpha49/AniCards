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
  variations?: readonly Variant[];
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
    <div className="border-t-2 border-gold/15 px-4 py-3 dark:border-gold/10">
      <div className="mb-2 flex items-center gap-2">
        <Label
          htmlFor={triggerId}
          className="
            block font-display text-[10px] tracking-[0.15em] text-muted-foreground uppercase
          "
        >
          {label}
        </Label>
        {selectedTooltip ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                data-tour="card-variant-info"
                className="
                  rounded-full p-0.5 text-muted-foreground transition-colors
                  hover:text-foreground
                  focus:outline-none
                  focus-visible:ring-2 focus-visible:ring-gold/50 focus-visible:ring-offset-1
                "
                aria-label={`${label} info`}
              >
                <Info className="size-3.5" aria-hidden="true" />
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
          className="h-9 w-full border-gold/20 text-sm focus:ring-gold/30 dark:border-gold/15"
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
