import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
interface StatCardProps {
	className?: string;
	icon: LucideIcon;
	title: string;
	description: string;
}

export function StatCard({ className, icon: Icon, title, description }: StatCardProps) {
	return (
		<div className={cn("flex items-center space-x-4", className)}>
			<Icon className="h-6 w-6 text-muted-foreground" />

			<div className="space-y-1">
				<p className="text-sm font-medium leading-none">{title}</p>
				<p className="text-2xl font-bold">{description}</p>
			</div>
		</div>
	);
}
