"use client";

import { motion } from "framer-motion";

interface MarketingBackdropProps {
  lightOpacity?: number;
  darkOpacity?: number;
}

export function MarketingBackdrop({
  lightOpacity = 0.5,
  darkOpacity = 0.3,
}: Readonly<MarketingBackdropProps>) {
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: lightOpacity }}
        transition={{ duration: 1.2, ease: "easeOut" }}
        className="pointer-events-none absolute inset-0 opacity-30 dark:hidden"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0L60 30L30 60L0 30Z' fill='none' stroke='%23a67c1a2e' stroke-width='1'/%3E%3C/svg%3E")`,
        }}
      />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: darkOpacity }}
        transition={{ duration: 1.2, ease: "easeOut" }}
        className="pointer-events-none absolute inset-0 hidden opacity-20 dark:block"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0L60 30L30 60L0 30Z' fill='none' stroke='%23c9a84c15' stroke-width='1'/%3E%3C/svg%3E")`,
        }}
      />
    </>
  );
}
