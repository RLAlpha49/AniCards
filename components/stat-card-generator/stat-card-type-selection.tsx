import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface CardType {
  id: string;
  label: string;
  variations?: { id: string; label: string }[];
}

interface StatCardTypeSelectionProps {
  cardTypes: CardType[];
  selectedCards: string[];
  selectedCardVariants: Record<string, string>;
  allSelected: boolean;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onVariantChange: (cardType: string, variant: string) => void;
  onPreview: (cardType: string, variant: string) => void;
}

export function StatCardTypeSelection({
  cardTypes,
  selectedCards,
  selectedCardVariants,
  allSelected,
  onToggle,
  onSelectAll,
  onVariantChange,
  onPreview,
}: StatCardTypeSelectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-lg font-semibold">
          Select Stat Cards to Generate
        </Label>
        <Button type="button" variant="outline" size="sm" onClick={onSelectAll}>
          {allSelected ? "Unselect All" : "Select All"}
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {cardTypes.map((type, index) => {
          const currentVariation =
            selectedCardVariants[type.id] || (type.variations ? "default" : "");
          return (
            <div
              key={type.id}
              className={cn(
                "flex flex-col items-start space-y-2 rounded-lg bg-secondary/50 p-3",
                "transition-all duration-300 hover:bg-secondary hover:shadow-lg",
                "group cursor-pointer hover:-translate-y-1",
                "fade-in-up animate-in fill-mode-backwards",
                selectedCards.includes(type.id) ? "ring-2 ring-primary" : "",
              )}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex w-full items-center space-x-2">
                <Checkbox
                  id={type.id}
                  checked={selectedCards.includes(type.id)}
                  onClick={(e) => e.stopPropagation()}
                  onCheckedChange={() => {
                    onToggle(type.id);
                  }}
                  className="mt-1 scale-90 transition-all duration-200 checked:scale-110 focus:ring-2 focus:ring-primary group-hover:scale-100"
                />
                <div className="flex-grow space-y-1">
                  <Label
                    htmlFor={type.id}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {type.label.split(" (")[0]}
                  </Label>
                  {type.label.includes("(") && (
                    <p className="text-xs text-muted-foreground transition-opacity duration-200 group-hover:opacity-100">
                      {type.label.match(/\((.*)\)/)?.[1]}
                    </p>
                  )}
                  {type.variations && (
                    <Select
                      value={currentVariation}
                      onValueChange={(value) => {
                        onVariantChange(type.id, value);
                      }}
                    >
                      <SelectTrigger className="h-8 w-[120px] bg-background/60 px-2">
                        <SelectValue placeholder="Variation" />
                      </SelectTrigger>
                      <SelectContent>
                        {type.variations.map((variation) => (
                          <SelectItem
                            key={variation.id}
                            value={variation.id}
                            className="text-xs"
                          >
                            {variation.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onPreview(type.id, currentVariation);
                    }}
                    className="scale-90 transition-all duration-200 hover:bg-primary hover:text-primary-foreground group-hover:scale-100"
                    title={`Preview ${type.label} card`}
                  >
                    Preview
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
