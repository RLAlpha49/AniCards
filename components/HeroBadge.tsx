"use client";

import React from "react";

type HeroBadgeProps = Readonly<{
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
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
