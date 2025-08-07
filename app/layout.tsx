import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import GithubCorner from "@/components/github-corner";
import GoogleAnalytics from "@/components/google-analytics";
import AnalyticsProvider from "@/components/analytics-provider";
import { LayoutShell } from "@/components/layout-shell";
import { Suspense } from "react";
import { generateMetadata as createMetadata } from "@/lib/seo";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = createMetadata({
  title: "AniCards - Transform Your AniList Data into Beautiful Cards",
  description:
    "AniCards transforms your AniList data into beautiful, shareable stat cards. Visualize your anime and manga consumption habits, preferences, and social activity with stunning graphics.",
  keywords: [
    "anilist",
    "anime",
    "manga",
    "stats",
    "cards",
    "visualization",
    "otaku",
    "weeb",
  ],
  canonical: "https://anicards.vercel.app",
});

// Root layout component for all pages
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID && (
          <GoogleAnalytics
            GA_TRACKING_ID={process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID}
          />
        )}
        <Providers>
          <Suspense fallback={<div>Loading...</div>}>
            <AnalyticsProvider>
              <LayoutShell>
                <GithubCorner />
                {children}
              </LayoutShell>
            </AnalyticsProvider>
          </Suspense>
          <Analytics />
          <SpeedInsights />
        </Providers>
      </body>
    </html>
  );
}
