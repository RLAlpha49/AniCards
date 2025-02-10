import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface ColorPickerItem {
	id: string;
	label: string;
	value: string;
	onChange: (newValue: string) => void;
}

interface ColorPickerGroupProps {
	pickers: ColorPickerItem[];
}

export function ColorPickerGroup({ pickers }: ColorPickerGroupProps) {
	return (
		<div className="grid grid-cols-2 gap-4">
			{pickers.map((picker) => (
				<div key={picker.id} className="space-y-2">
					<Label htmlFor={picker.id}>{picker.label} Color</Label>
					<div className="flex items-center space-x-2">
						<Input
							id={picker.id}
							type="color"
							value={picker.value}
							onChange={(e) => picker.onChange(e.target.value)}
							className="w-12 h-12 p-1 rounded transition-transform duration-200 hover:scale-105 transform-gpu cursor-pointer"
						/>
						<Input
							type="text"
							value={picker.value}
							onChange={(e) => picker.onChange(e.target.value)}
							className="flex-grow transition-all duration-200 focus:ring-2 focus:ring-primary"
						/>
					</div>
				</div>
			))}
		</div>
	);
}
