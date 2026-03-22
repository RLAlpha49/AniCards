"use client";

import { AlertCircle, Home, RefreshCw } from "lucide-react";
import Link from "next/link";
import type { ErrorInfo, ReactNode } from "react";
import { Component } from "react";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { safeTrack, trackError } from "@/lib/utils/google-analytics";

type ResetKey = string | number | boolean;

/**
 * Props accepted by the error boundary component.
 * @property children - React nodes rendered when there's no error.
 * @property fallback - Optional override for the default error UI.
 * @property onReset - Callback invoked every time the boundary is explicitly reset.
 * @property resetKeys - Keys (string/number/boolean) that trigger an automatic reset when their identity changes.
 * @source
 */
export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
  resetKeys?: ResetKey[];
}

/**
 * Tracks the current error state within the boundary.
 * @source
 */
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Returns true when two reset key collections differ.
 * @param prev - Previous reset keys.
 * @param next - Current reset keys.
 * @source
 */
function haveResetKeysChanged(prev?: ResetKey[], next?: ResetKey[]): boolean {
  if (prev === undefined && next === undefined) return false;
  if (prev === undefined || next === undefined) return true;
  if (prev.length !== next.length) return true;
  return prev.some((value, index) => value !== next[index]);
}

/**
 * React error boundary that reports issues to analytics and renders a styled fallback.
 * Designed to work with Next.js 16 + React 19 projects.
 * @source
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  /**
   * Updates the state when a child throws so we render the fallback UI.
   * @param error - The caught render error.
   * @source
   */
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  /**
   * Logs the error details to console and analytics for later investigation.
   * @param error - The thrown error.
   * @param errorInfo - React error information that includes the component stack.
   * @source
   */
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary] Caught error:", error, errorInfo);

    const compStack = (errorInfo?.componentStack ?? "").trim();
    const stackLines = compStack
      ? compStack
          .split(/\r?\n/)
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    const trimmedStack = stackLines.slice(0, 3).join(" | ");

    const messageParts: string[] = [];
    if (error?.message) messageParts.push(error.message);
    if (trimmedStack) messageParts.push(trimmedStack);
    let eventMessage = messageParts.join(" — ");
    const MAX_LEN = 200;
    if (eventMessage.length > MAX_LEN) {
      eventMessage = eventMessage.slice(0, MAX_LEN - 3) + "...";
    }

    safeTrack(() => trackError(error.name ?? "ErrorBoundary", eventMessage));
  }

  /**
   * Resets the error state when reset keys change so the boundary retries rendering.
   * @param prevProps - The prior props for comparison.
   * @source
   */
  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (
      this.state.hasError &&
      haveResetKeysChanged(prevProps.resetKeys, this.props.resetKeys)
    ) {
      this.resetErrorBoundary();
    }
  }

  /**
   * Clears the captured error and optionally notifies the consumer.
   * @source
   */
  resetErrorBoundary = () => {
    this.setState(
      {
        hasError: false,
        error: null,
      },
      () => {
        this.props.onReset?.();
      },
    );
  };

  /**
   * Default fallback UI presented when a rendering error occurs.
   * @returns The styled error screen.
   * @source
   */
  renderDefaultFallback(): ReactNode {
    const errorMessage =
      this.state.error?.message ??
      "We couldn't render this part of the experience.";

    return (
      <div className="
        flex min-h-screen w-full items-center justify-center bg-linear-to-br from-amber-50/50
        via-white to-amber-100/30 px-4 py-12
        dark:from-[#0C0A10] dark:via-[#110E18] dark:to-[#0C0A10]
      ">
        <div className="
          w-full max-w-2xl space-y-10 border border-red-200 bg-white/80 p-8 shadow-2xl
          backdrop-blur-xl
          dark:border-red-900/60 dark:bg-background/80
        ">
          <div className="flex items-center gap-3">
            <span className="
              rounded-full bg-red-100 p-2 text-red-600
              dark:bg-red-900/50 dark:text-red-300
            ">
              <AlertCircle className="size-6" />
            </span>
            <div>
              <p className="
                text-sm font-semibold tracking-[0.3em] text-red-600 uppercase
                dark:text-red-400
              ">
                Error
              </p>
              <h1 className="text-3xl font-bold text-foreground">
                Something went wrong
              </h1>
            </div>
          </div>

          <p className="text-base/relaxed text-foreground/60">{errorMessage}</p>

          <div className="space-y-3 sm:flex sm:items-center sm:justify-between sm:space-y-0">
            <Button
              variant="default"
              size="lg"
              className={cn("w-full", "sm:max-w-xs")}
              onClick={this.resetErrorBoundary}
            >
              <RefreshCw className="size-4" />
              Try Again
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className={cn("w-full", "sm:max-w-xs")}
            >
              <Link href="/" className="flex items-center justify-center gap-2">
                <Home className="size-4" />
                Go Home
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? this.renderDefaultFallback();
    }

    return this.props.children;
  }
}
