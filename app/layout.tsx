import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import Header from "@/components/header";

// Font configuration using Next.js's font optimization
const geistSans = Geist({
	variable: "--font-geist-sans", // CSS variable for sans-serif font
	subsets: ["latin"], // Only load latin character set
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono", // CSS variable for monospace font
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "Create Next App",
	description: "Generated by create next app",
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
					<Header />
					{children}
				</Providers>
			</body>
		</html>
	);
}
