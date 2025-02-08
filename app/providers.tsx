"use client";

import { ThemeProvider } from "next-themes";
import type React from "react";

export function Providers({ children }: { children: React.ReactNode }) {
	return <ThemeProvider attribute="class" defaultTheme="system">{children}</ThemeProvider>;
}
