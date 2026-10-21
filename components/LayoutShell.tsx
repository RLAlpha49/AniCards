"use client";

import React from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { cn } from "@/lib/utils";

/**
 * Application layout wrapper that provides the persistent header and footer.
 *
 * Navigation lives in the header masthead, so the main column spans the full
 * width with no sidebar rail or sidebar-driven margin.
 *
 * @param props.children - The layout's children.
 * @returns A layout container used across the app.
 * @source
 */
export function LayoutShell({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div
      className={cn("flex min-h-screen flex-col")}
      style={{ width: "100%" }}
    >
      {/* Fixed Header */}
      <div className="fixed top-0 z-50 w-full">
        <Header />
      </div>

      <main className="flex-1 pt-[61px]">{children}</main>

      <Footer />
    </div>
  );
}
