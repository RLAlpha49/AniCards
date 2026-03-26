import type { Transition, Variants } from "framer-motion";

// ── Shared easing curves ──

export const EASE_OUT_EXPO: [number, number, number, number] = [
  0.22, 1, 0.36, 1,
];

// ── Shared spring configs ──

export const SPRING_GENTLE: Transition = {
  type: "spring",
  stiffness: 200,
  damping: 20,
};

export const NO_MOTION_TRANSITION: Transition = {
  duration: 0,
};

interface MotionSafeStaggerOptions {
  reducedMotion?: boolean;
  staggerChildren?: number;
  delayChildren?: number;
}

interface MotionSafeRevealOptions {
  reducedMotion?: boolean;
  distance?: number;
  duration?: number;
}

interface MotionSafeScaleOptions {
  reducedMotion?: boolean;
  initialScale?: number;
  y?: number;
  duration?: number;
}

export function buildMotionSafeStaggerContainer({
  reducedMotion = false,
  staggerChildren = 0.12,
  delayChildren = 0.08,
}: MotionSafeStaggerOptions = {}): Variants {
  if (reducedMotion) {
    return {
      hidden: { opacity: 1 },
      visible: {
        opacity: 1,
        transition: NO_MOTION_TRANSITION,
      },
    };
  }

  return {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren, delayChildren },
    },
  };
}

export function buildFadeUpVariants({
  reducedMotion = false,
  distance = 28,
  duration = 0.7,
}: MotionSafeRevealOptions = {}): Variants {
  if (reducedMotion) {
    return {
      hidden: { opacity: 1, y: 0 },
      visible: {
        opacity: 1,
        y: 0,
        transition: NO_MOTION_TRANSITION,
      },
    };
  }

  return {
    hidden: { opacity: 0, y: distance },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration, ease: EASE_OUT_EXPO },
    },
  };
}

export function buildScaleInVariants({
  reducedMotion = false,
  initialScale = 0.92,
  y = 20,
  duration = 0.6,
}: MotionSafeScaleOptions = {}): Variants {
  if (reducedMotion) {
    return {
      hidden: { opacity: 1, scale: 1, y: 0 },
      visible: {
        opacity: 1,
        scale: 1,
        y: 0,
        transition: NO_MOTION_TRANSITION,
      },
    };
  }

  return {
    hidden: { opacity: 0, scale: initialScale, y },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: { duration, ease: EASE_OUT_EXPO },
    },
  };
}

export function getMotionSafeScrollBehavior(
  reducedMotion: boolean,
): ScrollBehavior {
  return reducedMotion ? "auto" : "smooth";
}

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
