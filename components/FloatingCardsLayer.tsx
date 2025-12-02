"use client";

import { motion } from "framer-motion";
import { useMemo, useState, useEffect } from "react";

import { cn } from "@/lib/utils";
import { ImageWithSkeleton } from "@/components/ImageWithSkeleton";
import {
  VARIATION_LABEL_MAP,
  buildCardUrlWithParams,
  generateExampleCardVariants,
  DEFAULT_EXAMPLE_USER_ID,
  mapStoredConfigToCardUrlParams,
} from "@/lib/card-groups";

/**
 * Example card variants generated for demo/preview displays.
 * @source
 */
const EXAMPLE_CARD_VARIANTS = generateExampleCardVariants(VARIATION_LABEL_MAP);

/**
 * Representation of a card variant used in the floating card layer.
 * @source
 */
type VariantCard = {
  id: string;
  title: string;
  variationLabel: string;
  src: string;
};

/**
 * In-memory library of variant cards used to pick random previews.
 * @source
 */
const VARIANT_LIBRARY: VariantCard[] = EXAMPLE_CARD_VARIANTS.map((variant) => ({
  id: `${variant.cardType}-${variant.variation}-${variant.label.replaceAll(/\s+/g, "-").toLowerCase()}`,
  title: variant.cardTitle,
  variationLabel: variant.label,
  src: buildCardUrlWithParams(
    mapStoredConfigToCardUrlParams(
      {
        cardName: variant.cardType,
        variation: variant.variation,
        useStatusColors:
          variant.extras?.statusColors === "true" ? true : undefined,
        colorPreset: "anilistDarkGradient",
      },
      { userId: DEFAULT_EXAMPLE_USER_ID, includeColors: false },
    ),
  ),
}));

/**
 * Floating card slot configuration with position and animation properties.
 * @source
 */
type FloatingSlot = {
  id: string;
  /** Position as percentage from container edges */
  position: {
    top?: string;
    bottom?: string;
    left?: string;
    right?: string;
  };
  /** Base rotation in degrees */
  rotation: number;
  /** Scale factor for the card */
  scale: number;
  /** Animation delay in seconds */
  delay: number;
  /** Opacity when fully visible */
  opacity: number;
  /** Responsive visibility */
  visibility: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
  /** Gradient accent color */
  accentGradient: string;
  /** Z-index for layering */
  zIndex: number;
};

/**
 * Layout presets for different page contexts.
 * @source
 */
const FLOATING_LAYOUTS: Record<string, FloatingSlot[]> = {
  hero: [
    // Left side cards - staggered vertically
    {
      id: "hero-left-top",
      position: { top: "12%", left: "3%" },
      rotation: -8,
      scale: 0.85,
      delay: 0,
      opacity: 0.85,
      visibility: "md",
      accentGradient: "from-blue-500/30 to-cyan-500/30",
      zIndex: 2,
    },
    {
      id: "hero-left-mid",
      position: { top: "42%", left: "1%" },
      rotation: -12,
      scale: 0.75,
      delay: 0.3,
      opacity: 0.7,
      visibility: "lg",
      accentGradient: "from-purple-500/30 to-pink-500/30",
      zIndex: 1,
    },
    {
      id: "hero-left-bottom",
      position: { bottom: "18%", left: "5%" },
      rotation: 6,
      scale: 0.9,
      delay: 0.6,
      opacity: 0.8,
      visibility: "md",
      accentGradient: "from-emerald-500/30 to-teal-500/30",
      zIndex: 3,
    },
    // Right side cards - staggered vertically
    {
      id: "hero-right-top",
      position: { top: "15%", right: "4%" },
      rotation: 10,
      scale: 0.88,
      delay: 0.2,
      opacity: 0.82,
      visibility: "md",
      accentGradient: "from-pink-500/30 to-rose-500/30",
      zIndex: 2,
    },
    {
      id: "hero-right-mid",
      position: { top: "45%", right: "1%" },
      rotation: 15,
      scale: 0.72,
      delay: 0.5,
      opacity: 0.65,
      visibility: "lg",
      accentGradient: "from-amber-500/30 to-orange-500/30",
      zIndex: 1,
    },
    {
      id: "hero-right-bottom",
      position: { bottom: "15%", right: "6%" },
      rotation: -6,
      scale: 0.92,
      delay: 0.8,
      opacity: 0.78,
      visibility: "md",
      accentGradient: "from-indigo-500/30 to-violet-500/30",
      zIndex: 3,
    },
  ],
  search: [
    {
      id: "search-left-top",
      position: { top: "18%", left: "4%" },
      rotation: -6,
      scale: 0.82,
      delay: 0,
      opacity: 0.75,
      visibility: "xl",
      accentGradient: "from-blue-500/25 to-purple-500/25",
      zIndex: 2,
    },
    {
      id: "search-left-bottom",
      position: { bottom: "22%", left: "6%" },
      rotation: 8,
      scale: 0.78,
      delay: 0.4,
      opacity: 0.7,
      visibility: "xl",
      accentGradient: "from-emerald-500/25 to-cyan-500/25",
      zIndex: 1,
    },
    {
      id: "search-right-top",
      position: { top: "20%", right: "5%" },
      rotation: 8,
      scale: 0.8,
      delay: 0.2,
      opacity: 0.72,
      visibility: "xl",
      accentGradient: "from-pink-500/25 to-rose-500/25",
      zIndex: 2,
    },
    {
      id: "search-right-bottom",
      position: { bottom: "20%", right: "4%" },
      rotation: -10,
      scale: 0.85,
      delay: 0.6,
      opacity: 0.68,
      visibility: "xl",
      accentGradient: "from-amber-500/25 to-orange-500/25",
      zIndex: 1,
    },
  ],
  compact: [
    {
      id: "compact-left",
      position: { top: "25%", left: "2%" },
      rotation: -10,
      scale: 0.7,
      delay: 0,
      opacity: 0.6,
      visibility: "lg",
      accentGradient: "from-blue-500/20 to-purple-500/20",
      zIndex: 1,
    },
    {
      id: "compact-right",
      position: { top: "30%", right: "2%" },
      rotation: 12,
      scale: 0.68,
      delay: 0.3,
      opacity: 0.55,
      visibility: "lg",
      accentGradient: "from-pink-500/20 to-rose-500/20",
      zIndex: 1,
    },
  ],
};

/** Visibility breakpoint to Tailwind class mapping. @source */
const VISIBILITY_CLASSES: Record<string, string> = {
  xs: "hidden xs:block",
  sm: "hidden sm:block",
  md: "hidden md:block",
  lg: "hidden lg:block",
  xl: "hidden xl:block",
  "2xl": "hidden 2xl:block",
};

type FloatingCardsLayerProps = {
  layout?: keyof typeof FLOATING_LAYOUTS;
  maxCards?: number;
  containerClassName?: string;
  /** Enable parallax-like depth effect */
  enableDepth?: boolean;
  /** Intensity of floating animation (0-1) */
  intensity?: number;
};

/**
 * Returns a random decimal value between min and max.
 * @source
 */
const randomBetween = (min: number, max: number) =>
  Math.random() * (max - min) + min;

/**
 * Select unique random variant cards from the library.
 * @source
 */
const selectRandomVariants = (count: number): VariantCard[] => {
  const pool = [...VARIANT_LIBRARY];
  const limit = Math.min(count, pool.length);
  const selected: VariantCard[] = [];

  for (let i = 0; i < limit; i += 1) {
    const randomIndex = Math.floor(Math.random() * pool.length);
    const [variant] = pool.splice(randomIndex, 1);
    if (variant) selected.push(variant);
  }

  return selected;
};

/**
 * Configuration for individual card animation behavior.
 * @source
 */
type CardAnimationConfig = {
  /** Vertical float amplitude */
  floatAmplitude: number;
  /** Rotation oscillation range */
  rotateAmplitude: number;
  /** Animation cycle duration */
  duration: number;
  /** Phase offset for desync */
  phaseOffset: number;
  /** Scale pulse amount */
  scalePulse: number;
};

/**
 * Generate randomized animation config for organic motion.
 * @source
 */
const generateAnimationConfig = (intensity: number): CardAnimationConfig => ({
  floatAmplitude: randomBetween(8, 18) * intensity,
  rotateAmplitude: randomBetween(2, 6) * intensity,
  duration: randomBetween(6, 10),
  phaseOffset: randomBetween(0, Math.PI * 2),
  scalePulse: randomBetween(0.02, 0.05) * intensity,
});

/**
 * Single floating card component with glassmorphism styling.
 * @source
 */
function FloatingCard({
  slot,
  variant,
  animConfig,
  enableDepth,
}: Readonly<{
  slot: FloatingSlot;
  variant: VariantCard | undefined;
  animConfig: CardAnimationConfig;
  enableDepth: boolean;
}>) {
  const positionStyle = {
    ...(slot.position.top && { top: slot.position.top }),
    ...(slot.position.bottom && { bottom: slot.position.bottom }),
    ...(slot.position.left && { left: slot.position.left }),
    ...(slot.position.right && { right: slot.position.right }),
    zIndex: slot.zIndex,
  };

  // Create smooth oscillating animation sequences
  const yKeyframes = [
    0,
    -animConfig.floatAmplitude * 0.5,
    -animConfig.floatAmplitude,
    -animConfig.floatAmplitude * 0.5,
    0,
    animConfig.floatAmplitude * 0.3,
    0,
  ];

  const rotateKeyframes = [
    slot.rotation,
    slot.rotation + animConfig.rotateAmplitude,
    slot.rotation,
    slot.rotation - animConfig.rotateAmplitude * 0.7,
    slot.rotation,
  ];

  const fixedScale = slot.scale;

  return (
    <motion.div
      className={cn("absolute", VISIBILITY_CLASSES[slot.visibility] ?? "block")}
      style={positionStyle}
      initial={{
        opacity: 0,
        scale: slot.scale * 0.7,
        rotate: slot.rotation,
        y: 20,
      }}
      animate={{
        opacity: slot.opacity,
        scale: fixedScale,
        rotate: rotateKeyframes,
        y: yKeyframes,
      }}
      transition={{
        opacity: { duration: 0.8, delay: slot.delay, ease: "easeOut" },
        scale: { duration: 0.8, delay: slot.delay, ease: "easeOut" },
        rotate: {
          duration: animConfig.duration * 1.2,
          repeat: Infinity,
          ease: "easeInOut",
          delay: slot.delay,
        },
        y: {
          duration: animConfig.duration,
          repeat: Infinity,
          ease: "easeInOut",
          delay: slot.delay,
        },
      }}
    >
      {/* Outer glow effect */}
      <div
        className={cn(
          "absolute -inset-4 rounded-2xl bg-gradient-to-br opacity-0 blur-xl transition-opacity duration-500 group-hover:opacity-100",
          slot.accentGradient,
        )}
        style={{
          opacity: enableDepth ? 0.4 : 0,
        }}
      />

      <div
        className={cn(
          "relative overflow-hidden rounded-2xl",
          "bg-white dark:bg-slate-800",
          "shadow-2xl shadow-slate-900/20 dark:shadow-black/50",
          "ring-1 ring-slate-200/80 dark:ring-slate-700/50",
          "before:absolute before:inset-0 before:rounded-2xl before:bg-gradient-to-br before:from-white/50 before:to-transparent before:opacity-80 dark:before:from-slate-700/30",
        )}
        style={{
          transform: "perspective(2000px) rotateX(10deg) rotateY(-10deg)",
          transformStyle: "preserve-3d",
        }}
      >
        {/* Inner content area */}
        <div className="relative p-2">
          <div
            className="overflow-hidden rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 shadow-inner dark:from-slate-900 dark:to-slate-800"
            style={{ borderRadius: "8px" }}
          >
            <ImageWithSkeleton
              src={variant?.src ?? ""}
              alt={
                variant
                  ? `${variant.title} • ${variant.variationLabel}`
                  : slot.id
              }
              className="h-auto w-full object-contain"
            />
          </div>
        </div>

        {/* Shimmer effect overlay */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
          animate={{
            x: ["-100%", "200%"],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            repeatDelay: animConfig.duration,
            ease: "easeInOut",
            delay: slot.delay + 1,
          }}
          style={{ opacity: 0.3 }}
        />
      </div>
    </motion.div>
  );
}

/**
 * Decorative floating cards layer with sophisticated animations.
 * Creates an ambient, dynamic background of sample stat cards.
 *
 * @param layout - Selects a predefined layout configuration.
 * @param maxCards - Maximum number of cards to display.
 * @param containerClassName - Additional container styling.
 * @param enableDepth - Enables glow effects for depth perception.
 * @param intensity - Animation intensity multiplier (0-1).
 * @source
 */
export function FloatingCardsLayer({
  layout = "hero",
  maxCards,
  containerClassName,
  enableDepth = true,
  intensity = 1,
}: Readonly<FloatingCardsLayerProps>) {
  const [isMounted, setIsMounted] = useState(false);

  // Avoid SSR hydration mismatch for randomized values
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const slots = FLOATING_LAYOUTS[layout] ?? FLOATING_LAYOUTS.hero;
  const cardCount = Math.max(
    1,
    Math.min(maxCards ?? slots.length, slots.length),
  );

  // Generate stable random variants after mount
  const selectedVariants = useMemo(
    () => (isMounted ? selectRandomVariants(cardCount) : []),
    [isMounted, cardCount],
  );

  // Generate animation configs after mount
  const animationConfigs = useMemo(
    () =>
      isMounted
        ? slots
            .slice(0, cardCount)
            .map(() => generateAnimationConfig(intensity))
        : [],
    [isMounted, slots, cardCount, intensity],
  );

  // Don't render until mounted to prevent hydration issues
  if (!isMounted) {
    return (
      <div
        className={cn(
          "pointer-events-none absolute inset-0 z-0",
          containerClassName,
        )}
        aria-hidden="true"
      />
    );
  }

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 z-0 overflow-hidden",
        containerClassName,
      )}
      aria-hidden="true"
    >
      {/* Ambient gradient underlays for depth */}
      {enableDepth && (
        <div className="absolute inset-0">
          {slots.slice(0, cardCount).map((slot, index) => (
            <motion.div
              key={`glow-${slot.id}`}
              className={cn(
                "absolute h-40 w-40 rounded-full blur-3xl",
                `bg-gradient-to-br ${slot.accentGradient}`,
                VISIBILITY_CLASSES[slot.visibility] ?? "block",
              )}
              style={{
                ...(slot.position.top && { top: slot.position.top }),
                ...(slot.position.bottom && { bottom: slot.position.bottom }),
                ...(slot.position.left && { left: slot.position.left }),
                ...(slot.position.right && { right: slot.position.right }),
                transform: "translate(-20%, -20%)",
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.3 }}
              transition={{ duration: 1, delay: slot.delay }}
            />
          ))}
        </div>
      )}

      {/* Floating cards */}
      {slots.slice(0, cardCount).map((slot, index) => (
        <FloatingCard
          key={slot.id}
          slot={slot}
          variant={selectedVariants[index]}
          animConfig={
            animationConfigs[index] ?? generateAnimationConfig(intensity)
          }
          enableDepth={enableDepth}
        />
      ))}
    </div>
  );
}
