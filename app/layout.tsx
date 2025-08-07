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
import { generateStructuredData, generateJsonLd } from "@/lib/structured-data";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = createMetadata({
  title:
    "AniCards - AniList Stat Cards Generator | Beautiful AniList Statistics",
  description:
    "Generate beautiful AniList stat cards from your anime and manga data. Create stunning, shareable AniList stat cards that visualize your consumption habits, preferences, and social activity with customizable designs.",
  keywords: [
    "anilist stat cards",
    "anilist statistics",
    "anime stat cards",
    "manga stat cards",
    "anilist data visualization",
    "anilist profile cards",
    "anime statistics generator",
    "manga statistics generator",
    "anilist",
    "anime",
    "manga",
    "stats",
    "cards",
    "visualization",
    "otaku",
    "weeb",
  ],
  canonical: "https://anicards.alpha49.com",
});

// Root layout component for all pages
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const structuredData = generateStructuredData("home");

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={generateJsonLd(structuredData)}
        />
      </head>
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
