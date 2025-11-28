"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Mail,
  Settings,
  File,
  Search,
  Folder,
  Grid3X3,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroupLabel,
  SidebarGroup,
  SidebarGroupContent,
} from "@/components/ui/Sidebar";

import { useState, useEffect } from "react";
import { trackNavigation, safeTrack } from "@/lib/utils/google-analytics";

/**
 * Navigation items rendered in the sidebar. Each item contains a title,
 * an icon component, a path to navigate to, and optional color styling.
 * @source
 */
const navItems = [
  {
    title: "Home",
    icon: Home,
    href: "/",
    gradient: "from-blue-500 to-cyan-500",
    bgLight: "bg-blue-100 dark:bg-blue-900/30",
    textColor: "text-blue-600 dark:text-blue-400",
  },
  {
    title: "Examples",
    icon: Grid3X3,
    href: "/examples",
    gradient: "from-purple-500 to-violet-500",
    bgLight: "bg-purple-100 dark:bg-purple-900/30",
    textColor: "text-purple-600 dark:text-purple-400",
  },
  {
    title: "Search",
    icon: Search,
    href: "/search",
    gradient: "from-green-500 to-emerald-500",
    bgLight: "bg-green-100 dark:bg-green-900/30",
    textColor: "text-green-600 dark:text-green-400",
  },
  {
    title: "Contact",
    icon: Mail,
    href: "/contact",
    gradient: "from-pink-500 to-rose-500",
    bgLight: "bg-pink-100 dark:bg-pink-900/30",
    textColor: "text-pink-600 dark:text-pink-400",
  },
  {
    title: "Settings",
    icon: Settings,
    href: "/settings",
    gradient: "from-orange-500 to-amber-500",
    bgLight: "bg-orange-100 dark:bg-orange-900/30",
    textColor: "text-orange-600 dark:text-orange-400",
  },
  {
    title: "Projects",
    icon: Folder,
    href: "/projects",
    gradient: "from-indigo-500 to-blue-500",
    bgLight: "bg-indigo-100 dark:bg-indigo-900/30",
    textColor: "text-indigo-600 dark:text-indigo-400",
  },
  {
    title: "License",
    icon: File,
    href: "/license",
    gradient: "from-slate-500 to-gray-500",
    bgLight: "bg-slate-100 dark:bg-slate-800/50",
    textColor: "text-slate-600 dark:text-slate-400",
  },
];

/**
 * Primary sidebar navigation component.
 * - Renders a list of nav items with icons and color-coded active states.
 * - Tracks navigation analytics when items are clicked.
 * - Uses a mount guard to avoid hydration mismatch.
 * - Features modern glassmorphism styling with animated indicators.
 * @returns Sidebar navigation element.
 * @source
 */
export function AppSidebar() {
  const pathname = usePathname();

  // Use a mount guard to avoid hydration differences between SSR and client.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleNavClick = (item: (typeof navItems)[0]) => {
    safeTrack(() => trackNavigation(item.title.toLowerCase(), "sidebar"));
  };

  if (!mounted) {
    return null;
  }

  return (
    <Sidebar
      collapsible="icon"
      className="mt-10 border-r border-slate-200/50 bg-white/80 backdrop-blur-xl dark:border-slate-700/50 dark:bg-slate-950/80"
    >
      <SidebarContent className="px-0 py-4">
        <SidebarGroup>
          <SidebarGroupLabel className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                      className="relative"
                    >
                      <Link
                        href={item.href}
                        onClick={() => handleNavClick(item)}
                        className={`relative flex items-center gap-2 rounded-xl text-sm font-medium transition-all ${
                          isActive
                            ? `${item.bgLight} ${item.textColor}`
                            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                        }`}
                      >
                        {/* Icon container */}
                        <div
                          className={`flex min-h-8 min-w-8 translate-x-[-8px] items-center justify-center rounded-xl transition-all ${
                            isActive
                              ? `bg-gradient-to-br ${item.gradient} text-white shadow-sm`
                              : "bg-slate-100 text-slate-500 group-hover/menu-item:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:group-hover/menu-item:bg-slate-700"
                          }`}
                        >
                          <item.icon className="h-4 w-4" />
                        </div>

                        <span className="flex-1">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
