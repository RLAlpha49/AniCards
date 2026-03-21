"use client";

import { AnimatePresence, motion } from "framer-motion";
import { usePathname } from "next/navigation";
import React from "react";

import Footer from "@/components/Footer";
import Header from "@/components/Header";
import { EASE_OUT_EXPO } from "@/lib/animations";

export function LayoutShell({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <AnimatePresence mode="wait">
        <motion.main
          key={pathname}
          initial={{ opacity: 0, y: 8, scale: 1 }}
          animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -8, scale: 0.99, filter: "blur(4px)" }}
          transition={{ duration: 0.3, ease: EASE_OUT_EXPO }}
          className="flex-1"
        >
          {children}
        </motion.main>
      </AnimatePresence>
      <Footer />
    </div>
  );
}
