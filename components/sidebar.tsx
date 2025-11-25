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
} from "@/components/ui/sidebar";

import { useState, useEffect } from "react";
import { trackNavigation } from "@/lib/utils/google-analytics";

/**
 * Navigation items rendered in the sidebar. Each item contains a title,
 * an icon component and a path to navigate to.
 * @source
 */
const navItems = [
  { title: "Home", icon: Home, href: "/" },
  { title: "Examples", icon: Grid3X3, href: "/examples" },
  { title: "Search", icon: Search, href: "/search" },
  //{ title: "Profile", icon: User, href: "/profile" },
  { title: "Contact", icon: Mail, href: "/contact" },
  { title: "Settings", icon: Settings, href: "/settings" },
  { title: "Projects", icon: Folder, href: "/projects" },
  { title: "License", icon: File, href: "/license" },
];

/**
 * Primary sidebar navigation component.
 * - Renders a list of nav items with icons.
 * - Tracks navigation analytics when items are clicked.
 * - Uses a mount guard to avoid hydration mismatch.
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
    trackNavigation(item.title.toLowerCase(), "sidebar");
  };

  if (!mounted) {
    return null;
  }

  return (
    <Sidebar collapsible="icon" className="mt-16">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.href}
                    tooltip={item.title}
                  >
                    <Link href={item.href} onClick={() => handleNavClick(item)}>
                      <item.icon />
                      <span>{item.title}</span>
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
