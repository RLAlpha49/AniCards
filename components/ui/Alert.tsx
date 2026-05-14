import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Class-variance-authority config for the Alert component's Tailwind CSS classes.
 * Provides variant-driven class names for the alert container.
 * @source
 */
const alertVariants = cva(
  `
    relative w-full border px-4 py-3 text-sm
    [&>svg]:absolute [&>svg]:top-4 [&>svg]:left-4 [&>svg]:text-foreground
    [&>svg+div]:translate-y-[-3px]
    [&>svg~*]:pl-7
  `,
  {
    variants: {
      variant: {
        default: "bg-background text-foreground",
        destructive:
          "border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

/**
 * Container component for inline alerts.
 * Supports `variant` variants and forwards all native div props.
 * @source
 */
const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div
    ref={ref}
    role="alert"
    className={cn(alertVariants({ variant }), className)}
    {...props}
  />
));
Alert.displayName = "Alert";

/**
 * Title element for an Alert; rendered prominently and accessible.
 * Falls back to a screen-reader-only label when children are absent.
 * @source
 */
const AlertTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, children, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn("mb-1 leading-none font-medium tracking-tight", className)}
    {...props}
  >
    {children ?? <span className="sr-only">Alert</span>}
  </h5>
));
AlertTitle.displayName = "AlertTitle";

/**
 * Secondary text for the Alert; used to provide contextual details.
 * @source
 */
const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm [&_p]:leading-relaxed", className)}
    {...props}
  />
));
AlertDescription.displayName = "AlertDescription";

export { Alert, AlertDescription, AlertTitle };
