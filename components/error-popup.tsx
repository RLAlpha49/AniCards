"use client";

import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
} from "@/components/ui/dialog";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ErrorPopupProps {
	isOpen: boolean;
	onClose: () => void;
	title: string;
	description: string;
	className?: string;
}

export function ErrorPopup({ isOpen, onClose, title, description, className }: ErrorPopupProps) {
	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className={cn("sm:max-w-[425px] border-red-500", className)}>
				<DialogHeader>
					<div className="flex items-center gap-2">
						<AlertCircle className="h-6 w-6 text-red-500" />
						<DialogTitle className="text-red-500">{title}</DialogTitle>
					</div>
					<DialogDescription className="pt-2 text-foreground">
						{description}
					</DialogDescription>
				</DialogHeader>
			</DialogContent>
		</Dialog>
	);
}
