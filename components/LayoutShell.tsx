"use client";

import React, { useState, useEffect } from "react";
import Header from "@/components/Header";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, useSidebar } from "@/components/ui/Sidebar";
import Footer from "@/components/Footer";
import { useIsMobile } from "@/hooks/use-mobile";

/**
 * Application layout wrapper that provides persistent header, sidebar and footer.
 * - Reads a saved sidebar state from cookies after hydration to avoid SSR mismatch.
 * - Provides CSS variables for sidebar widths and wraps content with SidebarProvider.
 * @param props - The layout's children.
 * @returns A layout container used across the app.
 * @source
 */
export function LayoutShell({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Initialize with deterministic value to prevent hydration mismatch
  const [defaultOpen, setDefaultOpen] = useState(false);

  // Read saved sidebar state from a cookie in useEffect after hydration to
  // prevent server/client mismatch during SSR.
  useEffect(() => {
    try {
      const saved = document.cookie
        .split("; ")
        .find((row) => row.startsWith("sidebar_state="))
        ?.split("=")[1];
      setDefaultOpen(saved === "true");
    } catch {
      // Gracefully handle cookie parsing or availability errors.
      setDefaultOpen(true);
    }
  }, []);

  return (
    <SidebarProvider
      defaultOpen={defaultOpen}
      style={
        {
          "--sidebar-width": "10rem",
          "--sidebar-width-mobile": "6rem",
        } as React.CSSProperties
      }
    >
      <LayoutShellContent>{children}</LayoutShellContent>
    </SidebarProvider>
  );
}

/**
 * Internal layout content wrapper that handles the responsive main content
 * area and conditional sidebar rendering.
 * @param props - Content children for the layout.
 * @returns The inner layout container rendered within SidebarProvider.
 * @source
 */
function LayoutShellContent({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { open } = useSidebar();
  const isMobile = useIsMobile();
  let sidebarMargin: string | number = "3rem";
  if (isMobile) {
    sidebarMargin = 0;
  } else if (open) {
    sidebarMargin = "10rem";
  }

  return (
    <div
      className="flex min-h-screen flex-col transition-all duration-300 ease-in-out"
      style={{ width: "100%" }}
    >
      {/* Fixed Header */}
      <div className="fixed top-0 z-50 w-full">
        <Header />
      </div>

      <div className="flex flex-1 pt-[61px]">
        {/* Fixed Sidebar */}
        {!isMobile && (
          <div
            className={`sidebar-container fixed left-0 top-[61px] z-40 overflow-hidden border-r !bg-white transition-all duration-300 ease-in-out dark:border-gray-700 dark:!bg-slate-950/80`}
            style={{
              height: `calc(100% - 61px)`,
              width: open ? "10rem" : "3rem",
            }}
          >
            <AppSidebar />
          </div>
        )}
        <main
          className="flex-1 transition-all duration-300 ease-in-out"
          style={{
            marginLeft: sidebarMargin,
          }}
        >
          {children}
        </main>
      </div>
      {isMobile && <AppSidebar />}
      <Footer />
    </div>
  );
}
