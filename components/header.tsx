import Link from "next/link";
import DarkModeToggle from "@/components/dark-mode-toggle";

// Site header component with dark mode support
export default function Header() {
	return (
		<header className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 transition-colors duration-300">
			{/* Logo link with dark mode text color switching */}
			<Link href="/" className="text-2xl font-bold text-gray-800 dark:text-white">
				Anicards
			</Link>

			{/* Dark mode toggle positioned at the right */}
			<DarkModeToggle />
		</header>
	);
}
