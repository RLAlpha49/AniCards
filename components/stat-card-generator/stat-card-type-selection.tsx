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
	allSelected: boolean;
	onToggle: (id: string) => void;
	onSelectAll: () => void;
	onPreview: (id: string) => void;
}

export function StatCardTypeSelection({
	cardTypes,
	selectedCards,
	allSelected,
	onToggle,
	onSelectAll,
	onPreview,
}: StatCardTypeSelectionProps) {
	return (
		<div className="space-y-4">
			<div className="flex justify-between items-center">
				<Label className="text-lg font-semibold">Select Stat Cards to Generate</Label>
				<Button type="button" variant="outline" size="sm" onClick={onSelectAll}>
					{allSelected ? "Unselect All" : "Select All"}
				</Button>
			</div>
			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				{cardTypes.map((type, index) => {
					const currentVariation =
						selectedCards.find((c) => c.startsWith(type.id))?.split("-")[1] ||
						"default";

					return (
						<div
							key={type.id}
							className={cn(
								"flex flex-col items-start space-y-2 bg-secondary/50 rounded-lg p-3",
								"transition-all duration-300 hover:bg-secondary hover:shadow-lg",
								"hover:-translate-y-1 cursor-pointer group",
								"animate-in fade-in-up fill-mode-backwards",
								selectedCards.some((c) => c.startsWith(type.id))
									? "ring-2 ring-primary"
									: ""
							)}
							style={{ animationDelay: `${index * 50}ms` }}
						>
							<div className="flex items-center w-full space-x-2">
								<Checkbox
									id={type.id}
									checked={selectedCards.some((c) => c.startsWith(type.id))}
									onCheckedChange={(checked) => {
										if (checked) {
											onToggle(
												`${type.id}-${type.variations?.[0].id || "default"}`
											);
										} else {
											selectedCards
												.filter((c) => c.startsWith(type.id))
												.forEach((c) => onToggle(c));
										}
									}}
									className="mt-1 transition-all duration-200 scale-90 group-hover:scale-100 checked:scale-110 focus:ring-2 focus:ring-primary"
								/>
								<div className="space-y-1 flex-grow">
									<Label
										htmlFor={type.id}
										className="text-sm font-medium leading-none 
                                peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
									>
										{type.label.split(" (")[0]}
									</Label>
									{type.label.includes("(") && (
										<p
											className="text-xs text-muted-foreground transition-opacity 
                                duration-200 group-hover:opacity-100"
										>
											{type.label.match(/\((.*)\)/)?.[1]}
										</p>
									)}
									{type.variations && (
										<Select
											value={currentVariation}
											onValueChange={(value) => {
												const existing = selectedCards.find((c) =>
													c.startsWith(type.id)
												);
												if (existing) onToggle(existing);
												onToggle(`${type.id}-${value}`);
											}}
										>
											<SelectTrigger className="w-[120px] h-8 px-2">
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
											const [cardName, variation] = type.id.split("-");
											onPreview(
												`${cardName}?variation=${variation || "default"}`
											);
										}}
										className="transition-all duration-200 hover:bg-primary hover:text-primary-foreground scale-90 group-hover:scale-100"
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
