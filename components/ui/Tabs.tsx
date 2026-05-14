"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
import * as React from "react";

import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      `
        flex w-full max-w-full min-w-0 items-stretch justify-start gap-1 overflow-x-auto
        overscroll-x-contain border border-gold/15 bg-muted p-1 text-muted-foreground
        sm:inline-flex sm:w-fit sm:justify-center
      `,
      className,
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      `
        inline-flex min-h-12 min-w-12 shrink-0 touch-manipulation-safe items-center justify-center
        border border-transparent px-4 py-2 text-sm font-medium whitespace-nowrap
        ring-offset-background transition-all
        focus-visible:ring-2 focus-visible:ring-gold/40 focus-visible:ring-offset-2
        focus-visible:outline-none
        disabled:pointer-events-none disabled:opacity-50
        data-[state=active]:border-gold/25 data-[state=active]:bg-gold/90
        data-[state=active]:text-white data-[state=active]:shadow-sm
        data-[state=active]:shadow-gold/15
        sm:min-h-9 sm:min-w-0 sm:px-3 sm:py-1.5
      `,
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      `
        mt-2 ring-offset-background
        focus-visible:ring-2 focus-visible:ring-gold/40 focus-visible:ring-offset-2
        focus-visible:outline-none
      `,
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsContent, TabsList, TabsTrigger };
