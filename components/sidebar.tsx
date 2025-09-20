"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Mail, Settings, File, Search, Folder } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroupLabel,
  SidebarGroup,
  SidebarGroupContent,
} from "@/components/ui/sidebar";

import { useState, useEffect } from "react";
import { trackNavigation } from "@/lib/utils/google-analytics";

const navItems = [
  { title: "Home", icon: Home, href: "/" },
  { title: "Search", icon: Search, href: "/search" },
  //{ title: "Profile", icon: User, href: "/profile" },
  { title: "Contact", icon: Mail, href: "/contact" },
  { title: "Settings", icon: Settings, href: "/settings" },
  { title: "Projects", icon: Folder, href: "/projects" },
  { title: "License", icon: File, href: "/license" },
];

export function AppSidebar() {
  const pathname = usePathname();

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleNavClick = (item: (typeof navItems)[0]) => {
    trackNavigation(item.title.toLowerCase(), "sidebar");
  };

  if (!mounted) {
    return null;
  }

  return (
    <Sidebar
      collapsible="icon"
      className="sidebar relative border-r border-blue-100/50 backdrop-blur-md dark:border-blue-900/30"
      style={{ marginTop: "48px" }}
    >
      {/* Full gradient background */}
      <div className="pointer-events-none absolute inset-0 h-full w-full"></div>

      <SidebarContent className="relative z-10 bg-transparent">
        {/* Accessibility: Hidden title and description for screen readers */}
        <div className="sr-only">
          <h2>Navigation Menu</h2>
          <p>Main navigation links for the AniCards application</p>
        </div>

        <SidebarGroup style={{ paddingTop: "1rem" }}>
          <SidebarGroupLabel className="mb-3 text-sm font-semibold text-blue-700 dark:text-blue-300">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.href}
                    className={`relative overflow-hidden rounded-lg transition-all duration-200 ease-in-out ${
                      pathname === item.href
                        ? "border border-blue-200/50 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 text-blue-700 shadow-md dark:border-blue-700/50 dark:text-blue-300"
                        : "text-gray-600 hover:bg-blue-50/50 hover:text-blue-600 dark:text-gray-300 dark:hover:bg-blue-900/20 dark:hover:text-blue-400"
                    } `}
                  >
                    <Link
                      href={item.href}
                      onClick={() => handleNavClick(item)}
                      className="flex w-full items-center px-3 py-2.5"
                    >
                      <item.icon
                        className={`h-5 w-5 ${pathname === item.href ? "text-blue-600 dark:text-blue-400" : ""} transition-colors duration-200`}
                      />
                      <span className="ml-3 text-sm font-medium transition-opacity duration-200 group-data-[collapsible=icon]:hidden">
                        {item.title}
                      </span>
                      {/* Active indicator */}
                      {pathname === item.href && (
                        <div className="absolute bottom-0 left-0 top-0 w-1 rounded-r-full bg-gradient-to-b from-blue-500 via-purple-500 to-pink-500"></div>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
