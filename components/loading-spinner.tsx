"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface LoadingSpinnerProps {
	size?: "sm" | "md" | "lg";
	className?: string;
	text?: string;
}

// Reusable loading spinner with animated SVG and optional text
export function LoadingSpinner({ size = "md", className, text }: LoadingSpinnerProps) {
	// Size variants for different usage contexts
	const sizes = {
		sm: "h-4 w-4", // Small - for inline loading
		md: "h-8 w-8", // Medium - default size
		lg: "h-12 w-12", // Large - for full page loads
	};

	return (
		<div className="inline-flex flex-col items-center gap-2">
			<motion.div
				initial={{ rotate: 0 }}
				animate={{ rotate: 360 }} // Continuous rotation
				transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
				className={cn(sizes[size], className)}
			>
				<svg className="w-full h-full" viewBox="0 0 24 24">
					<motion.circle
						cx="12"
						cy="12"
						r="10"
						stroke="currentColor"
						strokeWidth="4"
						fill="none"
						strokeLinecap="round" // Rounded stroke ends
						initial={{ pathLength: 0.25 }}
						animate={{
							pathLength: [0.25, 1, 0.25], // Stroke length animation
							rotate: [0, 270], // Offset rotation effect
						}}
						transition={{
							duration: 1.5,
							ease: "easeInOut",
							repeat: Infinity,
						}}
					/>
				</svg>
			</motion.div>
			{/* Optional animated loading text */}
			{text && (
				<motion.p
					className="text-sm text-muted-foreground"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
				>
					{text}
				</motion.p>
			)}
		</div>
	);
}

interface LoadingOverlayProps {
	text?: string;
}

// Full-screen loading overlay with backdrop blur
export function LoadingOverlay({ text = "Generating your cards..." }: LoadingOverlayProps) {
	return (
		<div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-[999]">
			<div className="flex flex-col items-center gap-4">
				<LoadingSpinner size="lg" className="text-primary" text={text ? undefined : ""} />
				{/* Pulsing text for visual emphasis */}
				<p className="text-muted-foreground animate-pulse">{text}</p>
			</div>
		</div>
	);
}
