import Link from "next/link";
import DarkModeToggle from "@/components/dark-mode-toggle";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

type HeaderProps = {
	onSidebarToggle: (open: boolean) => void;
	sidebarOpen: boolean;
};

export default function Header({ onSidebarToggle, sidebarOpen }: HeaderProps) {
	// Calculate the sidebar width using the same logic as in Footer.
	const sidebarWidth = sidebarOpen ? "calc(10rem)" : "calc(3.25rem - 4px)";

	return (
		<header className="relative z-50 bg-white dark:bg-gray-800 transition-colors duration-300 ease-in-out">
			<div className="flex items-center justify-between p-2">
				<div className="flex items-center gap-4">
					<SidebarProvider
						style={{
							minHeight: "0px",
							width: "32px",
							height: "32px",
							display: "flex",
							justifyContent: "center",
							alignItems: "center",
						}}
					>
						<SidebarTrigger
							onClick={() => onSidebarToggle(!sidebarOpen)}
							className="p-1 focus:outline-none transition-opacity duration-300 ease-in-out"
						/>
					</SidebarProvider>
					<Link
						href="/"
						className="text-2xl font-bold text-gray-800 dark:text-white transition-opacity duration-300 ease-in-out"
					>
						Anicards
					</Link>
				</div>
				<DarkModeToggle />
			</div>
			{/* Animated border element that cuts off the left portion by the sidebar's width */}
			<div
				style={{ marginLeft: sidebarWidth }}
				className="border-b border-gray-200 dark:border-gray-700 transition-all duration-200 ease-linear"
			/>
		</header>
	);
}
