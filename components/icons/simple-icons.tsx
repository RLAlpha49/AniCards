import { siDiscord, siAnilist, siGithub } from "simple-icons";

interface IconProps {
  size?: number;
  className?: string;
}

// Custom component to render the Discord icon using Simple Icons.
export const SimpleDiscordIcon = ({ size = 32, className = "" }: IconProps) => (
  <svg
    className={className}
    aria-label={siDiscord.title}
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
  >
    <title>{siDiscord.title}</title>
    <path d={siDiscord.path} />
  </svg>
);

// Custom component to render the GitHub icon using Simple Icons.
export const SimpleGithubIcon = ({ size = 32, className = "" }: IconProps) => (
  <svg
    className={className}
    aria-label={siGithub.title}
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
  >
    <title>{siGithub.title}</title>
    <path d={siGithub.path} />
  </svg>
);

// Custom component to render the AniList icon using Simple Icons.
export const SimpleAniListIcon = ({ size = 32, className = "" }: IconProps) => (
  <svg
    className={className}
    aria-label={siAnilist.title}
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
  >
    <title>{siAnilist.title}</title>
    <path d={siAnilist.path} />
  </svg>
);
