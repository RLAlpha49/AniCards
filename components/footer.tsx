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
      className="border-t border-gray-200 bg-white p-4 text-center dark:border-gray-700 dark:bg-gray-800"
    >
      <div className="mb-2 space-x-4">
        <Link
          href="https://anilist.co/user/Alpha49"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"
          onClick={() => trackExternalLinkClick("anilist", "footer")}
        >
          AniList Profile
        </Link>
        <Link
          href="https://discordid.netlify.app/?id=251479989378220044"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"
          onClick={() => trackExternalLinkClick("discord", "footer")}
        >
          Discord
        </Link>
        <Link
          href="mailto:contact@alpha49.com"
          className="text-blue-600 hover:underline"
          onClick={() => trackExternalLinkClick("email", "footer")}
        >
          Email
        </Link>
        <Link
          href="https://github.com/RLAlpha49"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"
          onClick={() => trackExternalLinkClick("github", "footer")}
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
