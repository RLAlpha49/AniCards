"use client";

import React, { useState, useEffect } from "react";
import Header from "@/components/header";
import { AppSidebar } from "@/components/sidebar";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import Footer from "@/components/footer";
import { useIsMobile } from "@/hooks/use-mobile";

export function LayoutShell({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Initialize with deterministic value to prevent hydration mismatch
  const [defaultOpen, setDefaultOpen] = useState(false);

  // Read from localStorage in useEffect after hydration
  useEffect(() => {
    try {
      const saved = document.cookie
        .split("; ")
        .find((row) => row.startsWith("sidebar_state="))
        ?.split("=")[1];
      setDefaultOpen(saved === "true");
    } catch {
      // Gracefully handle errors
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
            className={`sidebar-container fixed left-0 top-[61px] z-40 overflow-hidden border-r !bg-white transition-all duration-300 ease-in-out dark:border-gray-700 dark:!bg-slate-900/90`}
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
