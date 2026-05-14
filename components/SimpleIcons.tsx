import { siAnilist, siDiscord, siGithub } from "simple-icons";

/**
 * Props accepted by the simple icon components.
 * @property size - Width/height in pixels; defaults to 32.
 * @property className - Optional CSS class names to style the SVG.
 * @source
 */
interface IconProps {
  size?: number;
  className?: string;
}

/**
 * Discord icon wrapper using the `simple-icons` path data.
 * - Sets appropriate aria-label and default size.
 * @param props - Icon props.
 * @returns An SVG element for the Discord brand icon.
 * @source
 */
export const SimpleDiscordIcon = ({ size = 32, className = "" }: IconProps) => (
  <svg
    className={className}
    aria-hidden="true"
    focusable="false"
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
  >
    <path d={siDiscord.path} />
  </svg>
);

/**
 * GitHub icon wrapper using the `simple-icons` path data.
 * @param props - Icon props.
 * @returns An SVG element for the GitHub brand icon.
 * @source
 */
export const SimpleGithubIcon = ({ size = 32, className = "" }: IconProps) => (
  <svg
    className={className}
    aria-hidden="true"
    focusable="false"
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
  >
    <path d={siGithub.path} />
  </svg>
);

/**
 * AniList icon wrapper using the `simple-icons` path data.
 * @param props - Icon props.
 * @returns An SVG element for the AniList brand icon.
 * @source
 */
export const SimpleAniListIcon = ({ size = 32, className = "" }: IconProps) => (
  <svg
    className={className}
    aria-hidden="true"
    focusable="false"
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
  >
    <path d={siAnilist.path} />
  </svg>
);
