"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import DarkModeToggle from "@/components/dark-mode-toggle";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

type HeaderProps = {
  onSidebarToggle: (open: boolean) => void;
  sidebarOpen: boolean;
};

export default function Header({ onSidebarToggle, sidebarOpen }: HeaderProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const sidebarWidth = sidebarOpen ? "calc(10rem)" : "calc(3.25rem - 4px)";

  return (
    <header className="relative z-50 bg-white transition-colors duration-300 ease-in-out dark:bg-gray-800">
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
              className="p-1 transition-opacity duration-300 ease-in-out focus:outline-none"
            />
          </SidebarProvider>
          <Link
            href="/"
            className="text-2xl font-bold text-gray-800 transition-opacity duration-300 ease-in-out dark:text-white"
          >
            Anicards
          </Link>
        </div>
        <DarkModeToggle />
      </div>
      {/* Animated border element that cuts off the left portion by the sidebar's width */}
      <div
        style={{ marginLeft: sidebarWidth }}
        className="border-b border-gray-200 transition-all duration-200 ease-linear dark:border-gray-700"
      />
    </header>
  );
}
