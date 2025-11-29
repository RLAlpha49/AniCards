import * as React from "react";

/** Mobile viewport breakpoint in pixels used to determine "mobile" layout. @source */
const MOBILE_BREAKPOINT = 768;

/**
 * Hook that returns true when the viewport width is below the mobile breakpoint.
 * It listens for resize events using matchMedia and updates on width changes.
 * @returns {boolean} Whether the current viewport is considered mobile.
 * @source
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(
    undefined,
  );

  React.useEffect(() => {
    // Match any viewport width strictly less than MOBILE_BREAKPOINT
    const mql = globalThis.matchMedia(
      `(max-width: ${MOBILE_BREAKPOINT - 1}px)`,
    );
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;
}
