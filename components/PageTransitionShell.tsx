"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

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
    <main
      id="main-content"
      tabIndex={-1}
      className="flex-1 scroll-mt-24 focus:outline-none"
    >
      <div
        key={pathname}
        className={
          enableTransitions
            ? `
              motion-safe:animate-in motion-safe:duration-300 motion-safe:fade-in-0
              motion-safe:slide-in-from-bottom-2
            `
            : undefined
        }
      >
        {children}
      </div>
    </main>
  );
}
