import Link from "next/link";
import { Github } from "lucide-react";

export default function GithubCorner() {
  return (
    <div className={"absolute right-4 top-20 z-50"}>
      {/* The parent div uses "group" to allow hover-based styling of the tooltip. */}
      <div className="group relative inline-block">
        <Link
          href="https://github.com/RLAlpha49/Anicards"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Github size={44} className="text-gray-500 hover:text-gray-700" />
        </Link>
        <span className="pointer-events-none absolute right-full top-1/2 mr-2 -translate-y-1/2 scale-90 whitespace-nowrap rounded-full bg-gray-800 px-3 py-1 text-xs text-white opacity-0 transition-all duration-300 ease-in-out group-hover:scale-100 group-hover:opacity-100">
          View Project Repository
        </span>
      </div>
    </div>
  );
}
