"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import DarkModeToggle from "@/components/dark-mode-toggle";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { trackSidebarToggle } from "@/lib/utils/google-analytics";

type HeaderProps = {
  onSidebarToggle: (open: boolean) => void;
  sidebarOpen: boolean;
};

export default function Header({
  onSidebarToggle,
  sidebarOpen,
}: Readonly<HeaderProps>) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSidebarToggle = () => {
    const newState = !sidebarOpen;
    trackSidebarToggle(newState ? "expand" : "collapse");
    onSidebarToggle(newState);
  };

  if (!mounted) {
    return null;
  }

  return (
    <header className="relative z-50 border-b border-blue-100/50 bg-gradient-to-r from-blue-50/80 via-white/90 to-indigo-50/80 shadow-lg backdrop-blur-md transition-all duration-300 ease-in-out dark:border-blue-900/30 dark:from-slate-900/90 dark:via-gray-800/95 dark:to-blue-950/90">
      <div className="flex items-center justify-between p-3 px-4 pl-1.5">
        <div className="flex items-center gap-4">
          <SidebarProvider
            style={{
              minHeight: "0px",
              width: "36px",
              height: "36px",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <SidebarTrigger
              onClick={handleSidebarToggle}
              className="rounded-lg bg-blue-100/50 p-2 transition-all duration-200 ease-in-out hover:bg-blue-200/70 focus:outline-none focus:ring-2 focus:ring-blue-500/50 dark:bg-blue-900/30 dark:hover:bg-blue-800/50"
              aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            />
          </SidebarProvider>
          <Link
            href="/"
            className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-2xl font-bold text-transparent transition-all duration-300 ease-in-out hover:from-blue-700 hover:via-purple-700 hover:to-pink-700"
          >
            AniCards
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <DarkModeToggle />
        </div>
      </div>
    </header>
  );
}
