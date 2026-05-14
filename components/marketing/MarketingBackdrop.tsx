import { cn } from "@/lib/utils";

interface MarketingBackdropProps {
  lightOpacity?: number;
  darkOpacity?: number;
}

function getLightOpacityClass(value: number): string {
  if (value === 0.25) return "opacity-[0.25]";
  if (value === 0.35) return "opacity-[0.35]";
  if (value === 0.45) return "opacity-[0.45]";
  return "opacity-50";
}

function getDarkOpacityClass(value: number): string {
  if (value === 0.15) return "opacity-[0.15]";
  if (value === 0.22) return "opacity-[0.22]";
  if (value === 0.25) return "opacity-[0.25]";
  return "opacity-[0.3]";
}

export function MarketingBackdrop({
  lightOpacity = 0.5,
  darkOpacity = 0.3,
}: Readonly<MarketingBackdropProps>) {
  return (
    <>
      <div
        className={cn(
          `
            pointer-events-none absolute inset-0 marketing-backdrop-light
            motion-safe:animate-in motion-safe:duration-1000 motion-safe:fade-in-0
            dark:hidden
          `,
          getLightOpacityClass(lightOpacity),
        )}
      />
      <div
        className={cn(
          `
            pointer-events-none absolute inset-0 hidden marketing-backdrop-dark
            motion-safe:animate-in motion-safe:duration-1000 motion-safe:fade-in-0
            dark:block
          `,
          getDarkOpacityClass(darkOpacity),
        )}
      />
    </>
  );
}
