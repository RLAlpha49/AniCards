"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { motion } from "framer-motion";
import { Sun, Moon } from "lucide-react";

export default function DarkModeToggle() {
	// Prevent hydration mismatch by checking mount state
	const [mounted, setMounted] = useState(false);
	const { theme, resolvedTheme, setTheme } = useTheme();
	// Use resolvedTheme if theme is set to "system"
	const currentTheme = theme === "system" ? resolvedTheme : theme;

	useEffect(() => {
		setMounted(true); // Component has mounted (client-side)
	}, []);

	if (!mounted) return null; // Don't render until mounted

	return (
		<motion.button
			className="w-14 h-7 bg-gray-300 rounded-full p-1 flex items-center justify-between relative"
			onClick={() => setTheme(currentTheme === "dark" ? "light" : "dark")}
			animate={{ backgroundColor: currentTheme === "dark" ? "#4B5563" : "#D1D5DB" }}
			transition={{ duration: 0.3 }}
		>
			{/* Sun and Moon icons positioned absolutely */}
			<Sun className="h-5 w-5 text-yellow-500" />
			<Moon className="h-5 w-5 text-gray-800" />

			{/* Animated toggle thumb */}
			<motion.div
				className="absolute bg-white w-5 h-5 rounded-full shadow-md"
				animate={{
					x: currentTheme === "dark" ? 26 : 2, // Slide position based on theme
				}}
				transition={{
					type: "spring", // Bouncy animation
					stiffness: 700, // Spring tension
					damping: 30, // Spring friction
				}}
			/>
		</motion.button>
	);
}
