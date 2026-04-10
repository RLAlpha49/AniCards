import { describe, expect, it } from "bun:test";

import {
  buildFadeUpVariants,
  buildLineExpandVariants,
  buildMotionSafeStaggerContainer,
  buildScaleInVariants,
  getMotionSafeScrollBehavior,
  NO_MOTION_TRANSITION,
  shouldReduceMotion,
  shouldSimplifyMotion,
} from "@/lib/animations";

describe("motion-safe animation helpers", () => {
  it("returns static reveal variants when reduced motion is preferred", () => {
    const container = buildMotionSafeStaggerContainer({
      reducedMotion: true,
      staggerChildren: 0.1,
      delayChildren: 0.1,
    });
    const fadeUp = buildFadeUpVariants({
      reducedMotion: true,
      distance: 28,
      duration: 0.7,
    });
    const lineExpand = buildLineExpandVariants({
      reducedMotion: true,
      duration: 0.8,
    });
    const scaleIn = buildScaleInVariants({
      reducedMotion: true,
      initialScale: 0.85,
      y: 0,
      duration: 1.1,
    });

    expect(container.hidden).toEqual({ opacity: 1 });
    expect(container.visible).toEqual({
      opacity: 1,
      transition: NO_MOTION_TRANSITION,
    });
    expect(fadeUp.hidden).toEqual({ opacity: 1, y: 0 });
    expect(fadeUp.visible).toEqual({
      opacity: 1,
      y: 0,
      transition: NO_MOTION_TRANSITION,
    });
    expect(lineExpand.hidden).toEqual({ scaleX: 1, opacity: 1 });
    expect(lineExpand.visible).toEqual({
      scaleX: 1,
      opacity: 1,
      transition: NO_MOTION_TRANSITION,
    });
    expect(scaleIn.hidden).toEqual({ opacity: 1, scale: 1, y: 0 });
    expect(scaleIn.visible).toEqual({
      opacity: 1,
      scale: 1,
      y: 0,
      transition: NO_MOTION_TRANSITION,
    });
  });

  it("preserves the configured reveal motion when motion is allowed", () => {
    const container = buildMotionSafeStaggerContainer({
      staggerChildren: 0.08,
      delayChildren: 0.15,
    });
    const fadeUp = buildFadeUpVariants({
      distance: 40,
      duration: 0.9,
    });
    const lineExpand = buildLineExpandVariants({
      duration: 1.2,
    });
    const scaleIn = buildScaleInVariants({
      initialScale: 0.85,
      y: 0,
      duration: 1.1,
    });

    expect(container.hidden).toEqual({ opacity: 0 });
    expect(container.visible).toMatchObject({
      opacity: 1,
      transition: { staggerChildren: 0.08, delayChildren: 0.15 },
    });
    expect(fadeUp.hidden).toEqual({ opacity: 0, y: 40 });
    expect(fadeUp.visible).toMatchObject({
      opacity: 1,
      y: 0,
      transition: { duration: 0.9 },
    });
    expect(lineExpand.hidden).toEqual({ scaleX: 0, opacity: 0 });
    expect(lineExpand.visible).toMatchObject({
      scaleX: 1,
      opacity: 1,
      transition: { duration: 1.2 },
    });
    expect(scaleIn.hidden).toEqual({ opacity: 0, scale: 0.85, y: 0 });
    expect(scaleIn.visible).toMatchObject({
      opacity: 1,
      scale: 1,
      y: 0,
      transition: { duration: 1.1 },
    });
  });

  it("switches smooth scrolling off when reduced motion is preferred", () => {
    expect(getMotionSafeScrollBehavior(true)).toBe("auto");
    expect(getMotionSafeScrollBehavior(false)).toBe("smooth");
  });

  it("treats reduced data as a motion reduction signal for scrolling", () => {
    expect(shouldReduceMotion({ reducedData: true })).toBe(true);
    expect(
      getMotionSafeScrollBehavior(false, {
        reducedData: true,
      }),
    ).toBe("auto");
  });

  it("simplifies non-essential motion for coarse pointers and reduced data", () => {
    expect(shouldSimplifyMotion({ coarsePointer: true })).toBe(true);
    expect(shouldSimplifyMotion({ reducedData: true })).toBe(true);
    expect(shouldSimplifyMotion()).toBe(false);
  });
});
