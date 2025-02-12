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

interface ThemePreferencesProps {
	theme: string;
	themes: string[];
	onThemeChange: (value: string) => void;
}

export function ThemePreferences({ theme, themes, onThemeChange }: ThemePreferencesProps) {
	return (
		<motion.div
			initial={{ opacity: 0, y: 10 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ delay: 0.3 }}
			className="space-y-4"
		>
			<Label className="text-lg font-medium">Theme Preferences</Label>
			<Select value={theme} onValueChange={onThemeChange}>
				<SelectTrigger className="w-full max-w-[300px] bg-accent/40">
					<SelectValue placeholder="Select theme" />
				</SelectTrigger>
				<SelectContent className="rounded-lg">
					{themes.map((t) => (
						<SelectItem
							key={t}
							value={t}
							className="transition-colors hover:bg-accent/40"
						>
							{t.charAt(0).toUpperCase() + t.slice(1)}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</motion.div>
	);
}
