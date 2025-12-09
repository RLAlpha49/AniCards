import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Props for the stat card component showing a small icon and a statistic.
 * @property className - Optional class names to customize the card styling.
 * @property icon - Lucide icon component to render visually.
 * @property title - Small descriptive label for the statistic.
 * @property description - Prominent value or description to display.
 * @source
 */
interface StatCardProps {
  className?: string;
  icon: LucideIcon;
  title: string;
  description: string;
}

/**
 * Small reusable statistic card used to surface a numeric or textual metric.
 * @param props - Props for rendering the icon, label, and value.
 * @returns A small horizontal card with an icon and two lines of text.
 * @source
 */
export function StatCard({
  className,
  icon: Icon,
  title,
  description,
}: Readonly<StatCardProps>) {
  return (
    // Flex container for icon and text alignment
    <div className={cn("flex items-center space-x-4", className)}>
      {/* 
				Icon display:
				- Uses Lucide icons
				- Muted color for visual hierarchy
			*/}
      <Icon className="h-6 w-6 text-gray-600 dark:text-gray-400" />

      {/* Text content container */}
      <div className="space-y-1">
        {/* Title with medium font weight */}
        <p className="text-sm font-medium leading-none">{title}</p>

        {/* Primary statistic display */}
        <p className="text-2xl font-bold">{description}</p>
      </div>
    </div>
  );
}
