import {
  File,
  Folder,
  Grid3X3,
  Home,
  Mail,
  Search,
  Settings,
  type HugeIcon,
} from "@/lib/icons";

/** A single entry in the site navigation. @source */
export type NavItem = {
  title: string;
  href: string;
  icon: HugeIcon;
  bgLight: string;
  textColor: string;
};

/**
 * The site's top-level destinations.
 *
 * Shared by the masthead navigation and the mobile menu so the two never drift.
 *
 * @source
 */
export const NAV_ITEMS: readonly NavItem[] = [
  {
    title: "Home",
    icon: Home,
    href: "/",
    bgLight: "bg-blue-100 dark:bg-blue-900/30",
    textColor: "text-blue-600 dark:text-blue-400",
  },
  {
    title: "Examples",
    icon: Grid3X3,
    href: "/examples",
    bgLight: "bg-purple-100 dark:bg-purple-900/30",
    textColor: "text-purple-600 dark:text-purple-400",
  },
  {
    title: "Search",
    icon: Search,
    href: "/search",
    bgLight: "bg-green-100 dark:bg-green-900/30",
    textColor: "text-green-600 dark:text-green-400",
  },
  {
    title: "Contact",
    icon: Mail,
    href: "/contact",
    bgLight: "bg-pink-100 dark:bg-pink-900/30",
    textColor: "text-pink-600 dark:text-pink-400",
  },
  {
    title: "Settings",
    icon: Settings,
    href: "/settings",
    bgLight: "bg-orange-100 dark:bg-orange-900/30",
    textColor: "text-orange-600 dark:text-orange-400",
  },
  {
    title: "Projects",
    icon: Folder,
    href: "/projects",
    bgLight: "bg-indigo-100 dark:bg-indigo-900/30",
    textColor: "text-indigo-600 dark:text-indigo-400",
  },
  {
    title: "License",
    icon: File,
    href: "/license",
    bgLight: "bg-slate-100 dark:bg-slate-800/50",
    textColor: "text-slate-600 dark:text-slate-400",
  },
];
