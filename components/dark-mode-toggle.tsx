"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { motion } from "framer-motion";
import { Sun, Moon } from "lucide-react";

export default function DarkModeToggle() {
	const [mounted, setMounted] = useState(false);
	const { theme, setTheme } = useTheme();

	useEffect(() => {
		setMounted(true);
	}, []);

	if (!mounted) {
		return null;
	}

	return (
		<motion.button
			className="w-14 h-7 bg-gray-300 rounded-full p-1 flex items-center justify-between"
			onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
			animate={{ backgroundColor: theme === "dark" ? "#4B5563" : "#D1D5DB" }}
			transition={{ duration: 0.3 }}
		>
			<Sun className="h-5 w-5 text-yellow-500" />
			<Moon className="h-5 w-5 text-gray-800" />
			<motion.div
				className="absolute bg-white w-5 h-5 rounded-full shadow-md"
				animate={{
					x: theme === "dark" ? 26 : 2,
				}}
				transition={{ type: "spring", stiffness: 700, damping: 30 }}
			/>
		</motion.button>
	);
}
