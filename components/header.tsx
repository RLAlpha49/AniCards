"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import DarkModeToggle from "@/components/dark-mode-toggle";
import { SidebarTrigger } from "@/components/ui/sidebar";

/**
 * Application header that anchors to the top of the viewport.
 * - Includes the main navigation link and a dark mode toggle.
 * - Uses a mount check to avoid server/client rendering mismatch.
 * @returns A fixed header element.
 * @source
 */
export default function Header() {
  // Prevent layout mismatch between server and client by deferring rendering
  // until the component mounts on the client.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <header className="sticky top-0 z-50 flex h-16 items-center gap-4 border-b bg-background/80 px-6 pl-1.5 backdrop-blur-md transition-all dark:bg-slate-950/80">
      <div className="flex items-center gap-4">
        <SidebarTrigger className="h-9 w-9" />
        <Link
          href="/"
          className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-xl font-bold text-transparent transition-all hover:from-blue-500 hover:to-purple-500"
        >
          AniCards
        </Link>
      </div>
      <div className="ml-auto flex items-center gap-4">
        <DarkModeToggle />
      </div>
    </header>
  );
}
