"use client";

import React from "react";
import Link from "next/link";
import { useSidebar } from "@/components/ui/sidebar";

export default function Footer() {
	const { open } = useSidebar();
	const sidebarWidth = open ? "calc(10rem)" : "calc(3.25rem - 4px)";

	return (
		<footer
			style={{
				marginLeft: `calc(${sidebarWidth})`,
			}}
			className="bg-white dark:bg-gray-800 text-center p-4 border-t border-gray-200 dark:border-gray-700"
		>
			<div className="mb-2 space-x-4">
				<Link
					href="https://anilist.co/user/Alpha49"
					target="_blank"
					rel="noopener noreferrer"
					className="text-blue-600 hover:underline"
				>
					AniList Profile
				</Link>
				<Link
					href="https://discordid.netlify.app/?id=251479989378220044"
					target="_blank"
					rel="noopener noreferrer"
					className="text-blue-600 hover:underline"
				>
					Discord
				</Link>
				<Link href="mailto:contact@alpha49.com" className="text-blue-600 hover:underline">
					Email
				</Link>
				<Link
					href="https://github.com/RLAlpha49"
					target="_blank"
					rel="noopener noreferrer"
					className="text-blue-600 hover:underline"
				>
					GitHub
				</Link>
			</div>
			<div className="text-sm text-gray-500">
				&copy; {new Date().getFullYear()} Anicards |{" "}
				<Link
					href="https://github.com/RLAlpha49/Anicards/blob/main/LICENSE"
					className="hover:underline"
					target="_blank"
					rel="noopener noreferrer"
				>
					MIT Licensed
				</Link>
			</div>
		</footer>
	);
}
