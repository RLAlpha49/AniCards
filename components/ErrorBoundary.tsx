"use client";

import { AlertCircle, Home, RefreshCw } from "lucide-react";
import Link from "next/link";
import type { ErrorInfo, ReactNode } from "react";
import { Component } from "react";

import { Button } from "@/components/ui/Button";
import { getErrorDetails, type RecoverySuggestion } from "@/lib/error-messages";
import { reportStructuredError } from "@/lib/error-tracking";
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

export interface ErrorFallbackModel {
  heading: string;
  message: string;
  retryable: boolean;
  suggestions: RecoverySuggestion[];
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
 * Convert an Error into safe user-facing fallback content using the shared
 * structured error model.
 * @param error - Runtime error caught by a boundary.
 * @returns Safe fallback copy and recovery suggestions.
 * @source
 */
export function buildErrorFallbackModel(
  error: Error | null,
): ErrorFallbackModel {
  const details = getErrorDetails(
    error?.message ?? "We couldn't render this part of the experience.",
  );

  return {
    heading: "Something went wrong",
    message: details.userMessage,
    retryable: details.retryable,
    suggestions: details.suggestions,
  };
}

function isExternalActionUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

function RecoverySuggestionAction(
  props: Readonly<{ suggestion: RecoverySuggestion }>,
) {
  const actionUrl = props.suggestion.actionUrl;
  const actionLabel = props.suggestion.actionLabel;

  if (!actionUrl || !actionLabel) {
    return null;
  }

  if (isExternalActionUrl(actionUrl)) {
    return (
      <a
        href={actionUrl}
        target="_blank"
        rel="noreferrer noopener"
        className="text-sm font-medium text-gold underline-offset-4 hover:underline"
      >
        {actionLabel}
      </a>
    );
  }

  return (
    <Link
      href={actionUrl}
      className="text-sm font-medium text-gold underline-offset-4 hover:underline"
    >
      {actionLabel}
    </Link>
  );
}

export function ErrorFallbackPanel(
  props: Readonly<{
    error?: Error | null;
    onRetry?: () => void;
    retryLabel?: string;
    homeHref?: string;
    digest?: string;
    incidentReference?: string;
  }>,
) {
  const model = buildErrorFallbackModel(props.error ?? null);
  const incidentReference = props.incidentReference?.trim();
  const devDetailsVisible =
    process.env.NODE_ENV !== "production" &&
    Boolean(props.error?.message || props.digest);

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
              {model.heading}
            </h1>
          </div>
        </div>

        <div className="space-y-5">
          <p className="text-base/relaxed text-foreground/70">
            {model.message}
          </p>

          {incidentReference ? (
            <div className="border border-border/60 bg-background/50 p-4">
              <p className="text-sm font-semibold text-foreground">
                Incident reference
              </p>
              <p className="mt-1 font-mono text-sm tracking-wide text-foreground/80">
                {incidentReference}
              </p>
              <p className="mt-2 text-sm/relaxed text-muted-foreground">
                Include this reference if you report the problem so we can match
                it to the recorded incident faster.
              </p>
            </div>
          ) : null}

          {model.suggestions.length > 0 ? (
            <ul className="space-y-3 border border-border/60 bg-background/50 p-4">
              {model.suggestions.map((suggestion) => (
                <li key={`${suggestion.title}-${suggestion.description}`}>
                  <p className="text-sm font-semibold text-foreground">
                    {suggestion.title}
                  </p>
                  <p className="text-sm/relaxed text-muted-foreground">
                    {suggestion.description}
                  </p>
                  <RecoverySuggestionAction suggestion={suggestion} />
                </li>
              ))}
            </ul>
          ) : null}

          {devDetailsVisible ? (
            <details className="
              rounded-md border border-border/60 bg-background/40 p-4 text-sm text-muted-foreground
            ">
              <summary className="cursor-pointer font-medium text-foreground">
                Debug details
              </summary>
              <div className="mt-3 space-y-2">
                {props.error?.name ? (
                  <p>
                    <span className="font-semibold text-foreground">Name:</span>{" "}
                    {props.error.name}
                  </p>
                ) : null}
                {props.error?.message ? (
                  <p>
                    <span className="font-semibold text-foreground">
                      Message:
                    </span>{" "}
                    {props.error.message}
                  </p>
                ) : null}
                {props.digest && props.digest !== incidentReference ? (
                  <p>
                    <span className="font-semibold text-foreground">
                      Digest:
                    </span>{" "}
                    {props.digest}
                  </p>
                ) : null}
              </div>
            </details>
          ) : null}
        </div>

        <div className="space-y-3 sm:flex sm:items-center sm:justify-between sm:space-y-0">
          {props.onRetry ? (
            <Button
              variant="default"
              size="lg"
              className={cn("w-full", "sm:max-w-xs")}
              onClick={props.onRetry}
            >
              <RefreshCw className="size-4" />
              {props.retryLabel ?? (model.retryable ? "Try Again" : "Retry")}
            </Button>
          ) : null}
          <Button
            asChild
            variant="outline"
            size="lg"
            className={cn("w-full", "sm:max-w-xs")}
          >
            <Link
              href={props.homeHref ?? "/"}
              className="flex items-center justify-center gap-2"
            >
              <Home className="size-4" />
              Go Home
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
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

    void reportStructuredError({
      source: "react_error_boundary",
      userAction: "render_component_tree",
      error,
      componentStack: errorInfo.componentStack ?? undefined,
      route:
        globalThis.location === undefined
          ? undefined
          : `${globalThis.location.pathname}${globalThis.location.search}`,
      metadata: {
        boundary: "client_error_boundary",
      },
    });

    safeTrack(() =>
      trackError(error.name ?? "ErrorBoundary", error.message ?? undefined),
    );
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
    return (
      <ErrorFallbackPanel
        error={this.state.error}
        onRetry={this.resetErrorBoundary}
        retryLabel="Try Again"
      />
    );
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? this.renderDefaultFallback();
    }

    return this.props.children;
  }
}
