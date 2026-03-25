"use client";

import { AnimatePresence, motion } from "framer-motion";
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
  const [enableTransitions, setEnableTransitions] = useState(false);

  useEffect(() => {
    setEnableTransitions(true);
  }, []);

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.main
        key={pathname}
        initial={enableTransitions ? { opacity: 0, y: 8, scale: 1 } : false}
        animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
        exit={
          enableTransitions
            ? { opacity: 0, y: -8, scale: 0.99, filter: "blur(4px)" }
            : undefined
        }
        transition={{ duration: 0.3, ease: EASE_OUT_EXPO }}
        className="flex-1"
      >
        {children}
      </motion.main>
    </AnimatePresence>
  );
}
