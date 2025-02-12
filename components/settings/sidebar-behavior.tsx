import React from "react";
import { motion } from "framer-motion";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface SidebarBehaviorProps {
	sidebarDefault: boolean;
	onSidebarChange: (checked: boolean) => void;
}

export function SidebarBehavior({ sidebarDefault, onSidebarChange }: SidebarBehaviorProps) {
	return (
		<motion.div
			initial={{ opacity: 0, y: 10 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ delay: 0.4 }}
			className="space-y-4"
		>
			<Label className="text-lg font-medium">Sidebar Behavior</Label>
			<div className="flex items-center justify-between p-4 bg-accent/40 rounded-lg">
				<div>
					<p className="font-medium">Default State</p>
					<p className="text-sm text-muted-foreground">
						{sidebarDefault ? "Expanded" : "Collapsed"} by default
					</p>
				</div>
				<Switch
					checked={sidebarDefault}
					onCheckedChange={onSidebarChange}
					className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-input transition-colors"
				/>
			</div>
		</motion.div>
	);
}
