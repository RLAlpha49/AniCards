"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Mail, Settings, File, User } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";

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

const navItems = [
	{ title: "Home", icon: Home, href: "/" },
	{ title: "Profile", icon: User, href: "/profile" },
	{ title: "Contact", icon: Mail, href: "/contact" },
	{ title: "Settings", icon: Settings, href: "/settings" },
	{ title: "License", icon: File, href: "/license" },
];

export function AppSidebar() {
	const pathname = usePathname();
	const { open } = useSidebar();

	return (
		<Sidebar collapsible="icon" className="sidebar" style={{ marginTop: "48px" }}>
			<SidebarContent>
				<SidebarGroup style={{ paddingTop: "0px" }}>
					<SidebarGroupLabel>Navigation</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							{navItems.map((item) => (
								<SidebarMenuItem key={item.title}>
									<SidebarMenuButton asChild isActive={pathname === item.href}>
										<Link href={item.href}>
											<item.icon className="mr-2 h-4 w-4" />
											{open && <span>{item.title}</span>}
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
