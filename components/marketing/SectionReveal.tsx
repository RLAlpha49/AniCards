"use client";

import type { MotionStyle } from "framer-motion";
import { motion } from "framer-motion";
import type { ReactNode } from "react";

import { useMotionPreferences } from "@/hooks/useMotionPreferences";
import {
  buildFadeUpVariants,
  buildLineExpandVariants,
  VIEWPORT_ONCE,
} from "@/lib/animations";

const REVEAL_VARIANTS = {
  fadeUp: buildFadeUpVariants,
  lineExpand: buildLineExpandVariants,
} as const;

type RevealVariant = keyof typeof REVEAL_VARIANTS;

interface SectionRevealProps {
  children?: ReactNode;
  variant?: RevealVariant;
  className?: string;
  style?: MotionStyle;
}

export function SectionReveal({
  children,
  variant = "fadeUp",
  className,
  style,
}: Readonly<SectionRevealProps>) {
  const { prefersSimplifiedMotion } = useMotionPreferences();
  const variants = REVEAL_VARIANTS[variant]({
    reducedMotion: prefersSimplifiedMotion,
  });

  return (
    <motion.div
      variants={variants}
      initial="hidden"
      whileInView="visible"
      viewport={VIEWPORT_ONCE}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  );
}
