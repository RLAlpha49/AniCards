"use client";

import { Info } from "lucide-react";
import { memo, type ReactNode, useId, useState } from "react";

import { Label } from "@/components/ui/Label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/Popover";
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
  preferTapInfoDisclosure?: boolean;
}

function VariantInfoDisclosure({
  infoButton,
  isOpen,
  onOpenChange,
  preferTapInfoDisclosure,
  tooltip,
}: Readonly<{
  infoButton: ReactNode;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  preferTapInfoDisclosure: boolean;
  tooltip: string;
}>) {
  if (preferTapInfoDisclosure) {
    return (
      <Popover open={isOpen} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>{infoButton}</PopoverTrigger>
        <PopoverContent
          side="top"
          align="start"
          className="max-w-xs text-xs"
          sideOffset={8}
        >
          <p>{tooltip}</p>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{infoButton}</TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-xs" sideOffset={8}>
        <p>{tooltip}</p>
      </TooltipContent>
    </Tooltip>
  );
}

function getEffectiveVariant(
  currentVariant: string | undefined,
  variations: readonly Variant[],
): string {
  if (
    currentVariant &&
    variations.some((variation) => variation.id === currentVariant)
  ) {
    return currentVariant;
  }

  return variations[0].id;
}

export const VariantSelector = memo(function VariantSelector({
  variations,
  currentVariant,
  onVariantChange,
  getVariantTooltip,
  label = "Variant",
  onOpenChange,
  preferTapInfoDisclosure = false,
}: Readonly<VariantSelectorProps>) {
  const triggerId = useId();
  const [isInfoPopoverOpen, setIsInfoPopoverOpen] = useState(false);

  if (!variations || variations.length <= 1) return null;

  const effectiveVariant = getEffectiveVariant(currentVariant, variations);

  const selectedTooltip = getVariantTooltip?.(effectiveVariant) ?? null;
  const infoButton = selectedTooltip ? (
    <button
      type="button"
      data-tour="card-variant-info"
      className="
        flex size-11 touch-manipulation-safe items-center justify-center rounded-full
        text-muted-foreground transition-colors
        hover:text-foreground
        focus:outline-none
        focus-visible:ring-2 focus-visible:ring-gold/50 focus-visible:ring-offset-1
        sm:size-7
      "
      aria-label={`${label} info`}
    >
      <Info className="size-3.5" aria-hidden="true" />
    </button>
  ) : null;

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
          <VariantInfoDisclosure
            infoButton={infoButton}
            isOpen={isInfoPopoverOpen}
            onOpenChange={setIsInfoPopoverOpen}
            preferTapInfoDisclosure={preferTapInfoDisclosure}
            tooltip={selectedTooltip}
          />
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
