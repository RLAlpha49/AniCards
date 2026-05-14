import React from "react";

import Footer from "@/components/Footer";
import Header from "@/components/Header";
import { MAIN_CONTENT_ID } from "@/lib/shell-a11y";

export function LayoutShell({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-shell-viewport flex-col">
      <Header />
      <main
        id={MAIN_CONTENT_ID}
        tabIndex={-1}
        className="
          flex-1 scroll-mt-24
          focus:outline-none
          focus-visible:ring-2 focus-visible:ring-gold/50 focus-visible:ring-offset-2
          focus-visible:ring-offset-background
        "
      >
        {children}
      </main>
      <Footer />
    </div>
  );
}
