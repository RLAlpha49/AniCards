import type { ReactNode } from "react";
import { homeFontStyles } from "@/lib/fonts";
import styles from "./home.module.css";

/**
 * Paper surface shared by the home page sections.
 *
 * Paints the warm paper ground and lays a fine grain over the content. The
 * grain sits inside this element so portalled dialogs stay clean.
 *
 * Also publishes the home type variables on `:root`. The faces are imported
 * here, so their CSS ships with the home route rather than the whole app,
 * and the shared chrome above this surface can still read the variables.
 *
 * @param props.children - Page sections rendered on the paper.
 * @source
 */
export function HomeSurface({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className={styles.page}>
      <style>{homeFontStyles}</style>
      <svg className={styles.grain} aria-hidden="true" focusable="false">
        <filter id="home-grain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.9"
            numOctaves="4"
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#home-grain)" />
      </svg>
      {children}
    </div>
  );
}
