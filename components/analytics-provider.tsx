"use client";

import { useGoogleAnalytics } from "@/hooks/use-google-analytics";

export default function AnalyticsProvider({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  useGoogleAnalytics();
  return <>{children}</>;
}
