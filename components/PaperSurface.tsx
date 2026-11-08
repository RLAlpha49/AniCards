import type { ReactNode } from "react";
import { homeFontStyles } from "@/lib/fonts";
import styles from "./home/home.module.css";

/**
 * Paper surface shared by the paper-themed pages.
 *
 * Paints the warm paper ground and lays a fine grain over the content. The
 * grain sits inside this element so portalled dialogs stay clean.
 *
 * Also publishes the display and body type variables on `:root`. The faces are
 * imported here, so their CSS ships with the routes that use this surface
 * rather than the whole app, and the shared chrome above the surface can still
 * read the variables.
 *
 * @param props.children - Page sections rendered on the paper.
 * @source
 */
export function PaperSurface({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className={styles.page}>
      <style>{homeFontStyles}</style>
      <svg className={styles.grain} aria-hidden="true" focusable="false">
        <filter id="paper-grain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.9"
            numOctaves="4"
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#paper-grain)" />
      </svg>
      {children}
    </div>
  );
}
