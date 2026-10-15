"use client";

import React from "react";
import type { HugeIcon } from "@/lib/icons";

type HeroBadgeProps = Readonly<{
  icon: HugeIcon;
  children: React.ReactNode;
  className?: string;
}>;

export default function HeroBadge({
  icon: Icon,
  children,
  className = "",
}: HeroBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium shadow-sm backdrop-blur-sm ${className}`}
    >
      <Icon className="h-4 w-4" />
      {children}
    </span>
  );
}
