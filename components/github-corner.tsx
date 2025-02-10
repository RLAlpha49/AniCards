import Link from "next/link";
import { Github } from "lucide-react";

export default function GithubCorner() {
	return (
		<div className={"absolute top-20 right-4 z-50"}>
			{/* The parent div uses "group" to allow hover-based styling of the tooltip. */}
			<div className="group relative inline-block">
				<Link
					href="https://github.com/RLAlpha49/Anicards"
					target="_blank"
					rel="noopener noreferrer"
				>
					<Github size={44} className="text-gray-500 hover:text-gray-700" />
				</Link>
				<span
					className="absolute right-full top-1/2 -translate-y-1/2 mr-2 pointer-events-none
								scale-90 opacity-0 transition-all duration-300 ease-in-out
								group-hover:opacity-100 group-hover:scale-100
								bg-gray-800 text-white text-xs rounded-full py-1 px-3 whitespace-nowrap"
				>
					View Project Repository
				</span>
			</div>
		</div>
	);
}
