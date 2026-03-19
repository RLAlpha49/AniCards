"use client";

import { useGoogleAnalytics } from "@/hooks/useGoogleAnalytics";

/**
 * Client wrapper that initializes Google Analytics once on the client
 * and renders top-level children.
 * @param props - React children to render inside the provider.
 * @returns Rendered children.
 * @source
 */
export default function AnalyticsProvider({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  useGoogleAnalytics();
  return <>{children}</>;
}
