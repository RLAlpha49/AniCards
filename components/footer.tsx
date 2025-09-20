"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useSidebar } from "@/components/ui/sidebar";
import { trackExternalLinkClick } from "@/lib/utils/google-analytics";

export default function Footer() {
  const { open } = useSidebar();
  const sidebarWidth = open ? "calc(10rem)" : "calc(3.25rem - 4px)";
  const [marginLeft, setMarginLeft] = useState("0");

  useEffect(() => {
    const updateMargin = () => {
      if (window.innerWidth < 768) {
        setMarginLeft("0");
      } else {
        setMarginLeft(`calc(${sidebarWidth})`);
      }
    };

    updateMargin();
    window.addEventListener("resize", updateMargin);
    return () => window.removeEventListener("resize", updateMargin);
  }, [sidebarWidth]);

  return (
    <footer
      style={{ marginLeft }}
      className="relative overflow-hidden border-t border-blue-100/50 bg-gradient-to-r from-blue-50/60 via-white/80 to-indigo-50/60 shadow-lg backdrop-blur-md dark:border-blue-900/30 dark:from-slate-900/80 dark:via-gray-800/90 dark:to-blue-950/60"
    >
      {/* Decorative gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-pink-500/5 dark:from-blue-600/10 dark:via-purple-600/10 dark:to-pink-600/10"></div>

      <div className="relative p-6 text-center">
        <div className="mb-4 flex flex-wrap justify-center gap-6">
          <Link
            href="https://anilist.co/user/Alpha49"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex transform items-center space-x-2 rounded-lg bg-blue-100/50 px-3 py-2 text-blue-700 transition-all duration-200 ease-in-out hover:scale-105 hover:bg-blue-200/70 hover:text-blue-800 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-800/30 dark:hover:text-blue-300"
            onClick={() => trackExternalLinkClick("anilist", "footer")}
          >
            <div className="h-2 w-2 rounded-full bg-blue-500 group-hover:animate-pulse"></div>
            <span className="text-sm font-medium">AniList Profile</span>
          </Link>
          <Link
            href="https://discordid.netlify.app/?id=251479989378220044"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex transform items-center space-x-2 rounded-lg bg-purple-100/50 px-3 py-2 text-purple-700 transition-all duration-200 ease-in-out hover:scale-105 hover:bg-purple-200/70 hover:text-purple-800 dark:bg-purple-900/20 dark:text-purple-400 dark:hover:bg-purple-800/30 dark:hover:text-purple-300"
            onClick={() => trackExternalLinkClick("discord", "footer")}
          >
            <div className="h-2 w-2 rounded-full bg-purple-500 group-hover:animate-pulse"></div>
            <span className="text-sm font-medium">Discord</span>
          </Link>
          <Link
            href="mailto:contact@alpha49.com"
            className="group flex transform items-center space-x-2 rounded-lg bg-green-100/50 px-3 py-2 text-green-700 transition-all duration-200 ease-in-out hover:scale-105 hover:bg-green-200/70 hover:text-green-800 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-800/30 dark:hover:text-green-300"
            onClick={() => trackExternalLinkClick("email", "footer")}
          >
            <div className="h-2 w-2 rounded-full bg-green-500 group-hover:animate-pulse"></div>
            <span className="text-sm font-medium">Email</span>
          </Link>
          <Link
            href="https://github.com/RLAlpha49"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex transform items-center space-x-2 rounded-lg bg-gray-100/50 px-3 py-2 text-gray-700 transition-all duration-200 ease-in-out hover:scale-105 hover:bg-gray-200/70 hover:text-gray-800 dark:bg-gray-700/30 dark:text-gray-400 dark:hover:bg-gray-600/40 dark:hover:text-gray-300"
            onClick={() => trackExternalLinkClick("github", "footer")}
          >
            <div className="h-2 w-2 rounded-full bg-gray-500 group-hover:animate-pulse"></div>
            <span className="text-sm font-medium">GitHub</span>
          </Link>
        </div>

        <div className="border-t border-blue-200/30 pt-4 dark:border-blue-800/30">
          <div className="flex flex-col items-center justify-center space-y-2 text-sm text-gray-600 dark:text-gray-400 sm:flex-row sm:space-x-2 sm:space-y-0">
            <span>&copy; {new Date().getFullYear()} AniCards</span>
            <span className="hidden sm:inline">•</span>
            <Link
              href="https://github.com/RLAlpha49/Anicards/blob/main/LICENSE"
              className="inline-flex items-center space-x-1 font-medium text-blue-600 transition-colors duration-200 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span>MIT Licensed</span>
              <div className="h-1 w-1 rounded-full bg-blue-500"></div>
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
