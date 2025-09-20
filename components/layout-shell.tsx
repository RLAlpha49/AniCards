"use client";

import React from "react";
import Header from "@/components/header";
import { AppSidebar } from "@/components/sidebar";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import Footer from "@/components/footer";

export function LayoutShell({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const defaultOpen =
    typeof window !== "undefined"
      ? (() => {
          const saved = localStorage.getItem("anicards-sidebarDefaultOpen");
          return saved ? JSON.parse(saved).value : false;
        })()
      : false;

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
      {/* Header now spans full width and takes priority */}
      <Header onSidebarToggle={toggleSidebar} sidebarOpen={open} />
      <div className="flex flex-1 transition-all duration-300 ease-in-out">
        <div
          className={`sidebar-container overflow-hidden border-r !bg-white transition-all duration-300 ease-in-out dark:border-gray-700 dark:!bg-slate-900/90`}
          style={{
            height: `calc(100% + 137.8px)`,
          }}
        >
          <AppSidebar />
        </div>
        <main className="flex-1">{children}</main>
      </div>
      <Footer />
    </div>
  );
}
