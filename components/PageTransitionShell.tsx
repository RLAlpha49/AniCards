"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { EASE_OUT_EXPO } from "@/lib/animations";

interface PageTransitionShellProps {
  children: ReactNode;
}

export function PageTransitionShell({
  children,
}: Readonly<PageTransitionShellProps>) {
  const pathname = usePathname();
  const prefersReducedMotion = useReducedMotion() ?? false;
  const [enableTransitions, setEnableTransitions] = useState(false);

  useEffect(() => {
    setEnableTransitions(true);
  }, []);

  if (prefersReducedMotion) {
    return (
      <main key={pathname} className="flex-1">
        {children}
      </main>
    );
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.main
        key={pathname}
        initial={enableTransitions ? { opacity: 0, y: 8 } : false}
        animate={{ opacity: 1, y: 0 }}
        exit={enableTransitions ? { opacity: 0, y: -8 } : undefined}
        transition={{ duration: 0.3, ease: EASE_OUT_EXPO }}
        className="flex-1"
      >
        {children}
      </motion.main>
    </AnimatePresence>
  );
}
