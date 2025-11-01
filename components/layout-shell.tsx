"use client";

import React, { useState, useEffect } from "react";
import Header from "@/components/header";
import { AppSidebar } from "@/components/sidebar";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import Footer from "@/components/footer";

export function LayoutShell({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Initialize with deterministic value to prevent hydration mismatch
  const [defaultOpen, setDefaultOpen] = useState(false);

  // Read from localStorage in useEffect after hydration
  useEffect(() => {
    try {
      const saved = localStorage.getItem("anicards-sidebarDefaultOpen");
      setDefaultOpen(saved ? JSON.parse(saved).value : false);
    } catch {
      // Gracefully handle localStorage errors
      setDefaultOpen(false);
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
  const { open, toggleSidebar } = useSidebar();

  return (
    <div
      className="flex min-h-screen flex-col transition-all duration-300 ease-in-out"
      style={{ width: "100%" }}
    >
      {/* Fixed Header */}
      <div className="fixed top-0 z-50 w-full">
        <Header onSidebarToggle={toggleSidebar} sidebarOpen={open} />
      </div>

      <div className="flex flex-1 pt-[61px]">
        {/* Fixed Sidebar */}
        <div
          className={`sidebar-container fixed left-0 top-[61px] z-40 overflow-hidden border-r !bg-white transition-all duration-300 ease-in-out dark:border-gray-700 dark:!bg-slate-900/90`}
          style={{
            height: `calc(100% - 61px)`,
            width: open ? "10rem" : "3rem",
          }}
        >
          <AppSidebar />
        </div>
        <main
          className="flex-1 transition-all duration-300 ease-in-out"
          style={{
            marginLeft: open ? "10rem" : "3rem",
          }}
        >
          {children}
        </main>
      </div>
      <Footer />
    </div>
  );
}
