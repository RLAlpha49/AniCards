import React from "react";

import Footer from "@/components/Footer";
import Header from "@/components/Header";
import { PageTransitionShell } from "@/components/PageTransitionShell";

export function LayoutShell({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <PageTransitionShell>{children}</PageTransitionShell>
      <Footer />
    </div>
  );
}
