import type { Transition, Variants } from "framer-motion";

// ── Shared easing curves ──

export const EASE_OUT_EXPO: [number, number, number, number] = [
  0.22, 1, 0.36, 1,
];
export const EASE_OUT_QUINT: [number, number, number, number] = [
  0.23, 1, 0.32, 1,
];

// ── Shared spring configs ──

export const SPRING_SNAPPY: Transition = {
  type: "spring",
  stiffness: 400,
  damping: 25,
};

export const SPRING_GENTLE: Transition = {
  type: "spring",
  stiffness: 200,
  damping: 20,
};

// ── Scroll-reveal section container ──

export const sectionReveal: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.08 },
  },
};

// ── Fade up variant (common child) ──

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 28 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: EASE_OUT_EXPO },
  },
};

// ── Fade in variant (no translate) ──

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.6, ease: EASE_OUT_EXPO },
  },
};

// ── Scale-in card variant ──

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.92, y: 20 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.6, ease: EASE_OUT_EXPO },
  },
};

// ── Stagger container (generic, customizable via props) ──

export function staggerContainer(stagger = 0.1, delay = 0.06): Variants {
  return {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: stagger, delayChildren: delay },
    },
  };
}

// ── Expand line (horizontal divider reveal) ──

export const lineExpand: Variants = {
  hidden: { scaleX: 0, opacity: 0 },
  visible: {
    scaleX: 1,
    opacity: 1,
    transition: { duration: 0.8, ease: EASE_OUT_EXPO },
  },
};

// ── Viewport config presets ──

export const VIEWPORT_ONCE = { once: true, margin: "-60px" as const };
export const VIEWPORT_ONCE_NEAR = { once: true, margin: "-30px" as const };

// ── Staggered index delay helper ──

export function indexDelay(index: number, base = 0.08): number {
  return index * base;
}

// ── Hover micro-interactions ──

export const hoverLift = {
  whileHover: { y: -6, transition: { duration: 0.3, ease: EASE_OUT_EXPO } },
};

export const hoverScale = {
  whileHover: {
    scale: 1.04,
    transition: { duration: 0.3, ease: EASE_OUT_EXPO },
  },
};

export const tapShrink = {
  whileTap: { scale: 0.97 },
};

// ── Slide-in from direction ──

export function slideFrom(
  direction: "left" | "right" | "top" | "bottom",
  distance = 40,
): Variants {
  const isHorizontal = direction === "left" || direction === "right";
  const sign = direction === "left" || direction === "top" ? -1 : 1;
  const offset = sign * distance;
  const hidden = isHorizontal
    ? { opacity: 0, x: offset }
    : { opacity: 0, y: offset };
  const visible = isHorizontal
    ? { opacity: 1, x: 0, transition: { duration: 0.7, ease: EASE_OUT_EXPO } }
    : { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE_OUT_EXPO } };
  return { hidden, visible };
}
