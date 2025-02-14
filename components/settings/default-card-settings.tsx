import React from "react";
import { motion } from "framer-motion";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { colorPresets, statCardTypes } from "@/components/stat-card-generator";

interface DefaultCardSettingsProps {
	defaultPreset: string;
	onPresetChange: (value: string) => void;
	defaultCardTypes: string[];
	defaultVariants: Record<string, string>;
	onToggleCardType: (cardType: string) => void;
	onToggleAllCardTypes: () => void;
	onVariantChange: (cardType: string, variant: string) => void;
}

export function DefaultCardSettings({
	defaultPreset,
	onPresetChange,
	defaultCardTypes,
	defaultVariants,
	onToggleCardType,
	onToggleAllCardTypes,
	onVariantChange,
}: DefaultCardSettingsProps) {
	return (
		<motion.div
			initial={{ opacity: 0, y: 10 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ delay: 0.8 }}
			className="space-y-4"
		>
			<Label className="text-lg font-medium">Default Card Settings</Label>
			<div className="space-y-6 p-4 bg-accent/40 rounded-lg">
				<Select value={defaultPreset} onValueChange={onPresetChange}>
					<SelectTrigger className="w-full max-w-[300px] bg-background/60">
						<SelectValue placeholder="Select color preset" />
					</SelectTrigger>
					<SelectContent>
						{Object.keys(colorPresets).map((preset) => (
							<SelectItem key={preset} value={preset}>
								{preset.charAt(0).toUpperCase() + preset.slice(1)}
							</SelectItem>
						))}
					</SelectContent>
				</Select>

				<div className="space-y-2">
					<Label>Default Card Types</Label>
					<div className="flex mb-2">
						<Button variant="outline" size="sm" onClick={onToggleAllCardTypes}>
							{defaultCardTypes.length === statCardTypes.length
								? "Unselect All"
								: "Select All"}
						</Button>
					</div>
					<div className="grid grid-cols-1 md:grid-cols-2 gap-2">
						{statCardTypes.map((type) => {
							const hasVariants = type.variations && type.variations.length > 0;
							const currentVariant = defaultVariants[type.id] || "default";
							
							return (
								<div key={type.id} className="flex flex-col space-y-2">
									<div className="flex items-center space-x-2">
										<Checkbox
											id={type.id}
											checked={defaultCardTypes.includes(type.id)}
											onCheckedChange={() => onToggleCardType(type.id)}
										/>
										<Label htmlFor={type.id} className="text-sm">
											{type.label.split(" (")[0]}
										</Label>
									</div>
									{hasVariants && defaultCardTypes.includes(type.id) && (
										<Select
											value={currentVariant}
											onValueChange={(value) => onVariantChange(type.id, value)}
										>
											<SelectTrigger className="w-full h-8 bg-background/60">
												<SelectValue placeholder="Variant" />
											</SelectTrigger>
											<SelectContent>
												{type.variations?.map((variation) => (
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
							);
						})}
					</div>
				</div>
			</div>
		</motion.div>
	);
}
