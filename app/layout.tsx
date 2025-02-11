import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import GithubCorner from "@/components/github-corner";
import { LayoutShell } from "@/components/layout-shell";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "AniCards",
	description:
		"Anicards is an app that transforms your Anilist data into beautiful, shareable stat cards. It provides a unique way to visualize your anime and manga consumption habits, preferences, and social activity.",
};

// Root layout component for all pages
export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" suppressHydrationWarning>
			{/* 
				Apply font variables to body for global access
				antialiased: Enables font smoothing 
			*/}
			<body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
				<Providers>
					<LayoutShell>
						<GithubCorner />
						{children}
					</LayoutShell>
					<Analytics />
					<SpeedInsights />
				</Providers>
			</body>
		</html>
	);
}
