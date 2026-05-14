"use client";

import { AlertCircle, Home, RefreshCw } from "lucide-react";
import Link from "next/link";
import {
  Component,
  type ErrorInfo,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import { Button } from "@/components/ui/Button";
import { logPrivacySafe } from "@/lib/api/logging";
import {
  type ErrorCategory,
  extractStructuredErrorContext,
  getErrorDetails,
  type RecoverySuggestion,
} from "@/lib/error-messages";
import {
  sanitizeErrorReportRoute,
  sanitizeErrorReportStackTrace,
} from "@/lib/error-report-sanitization";
import {
  type ErrorReportDurabilityStatus,
  getImmediateIncidentReference,
  reportStructuredError,
} from "@/lib/error-tracking";
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
  debugComponentStack?: string;
  debugRoute?: string;
  incidentReference?: string;
  incidentStatus: ErrorReportDurabilityStatus;
}

export interface ErrorFallbackModel {
  heading: string;
  message: string;
  category: ErrorCategory;
  retryDelayMs?: number;
  retryable: boolean;
  suggestions: RecoverySuggestion[];
}

function getIncidentStatusTone(status: ErrorReportDurabilityStatus): string {
  switch (status) {
    case "confirmed":
      return "text-emerald-700 dark:text-emerald-300";
    case "queued":
      return "text-amber-700 dark:text-amber-300";
    case "unconfirmed":
      return "text-red-700 dark:text-red-300";
  }
}

function getIncidentStatusLabel(status: ErrorReportDurabilityStatus): string {
  switch (status) {
    case "confirmed":
      return "Recorded";
    case "queued":
      return "Queued";
    case "unconfirmed":
      return "Unconfirmed";
  }
}

function getIncidentStatusMessage(status: ErrorReportDurabilityStatus): string {
  switch (status) {
    case "confirmed":
      return "We confirmed this incident reference was durably recorded for follow-up.";
    case "queued":
      return "We saved this incident locally and will retry delivery automatically when conditions improve.";
    case "unconfirmed":
      return "We could not confirm durable incident recording yet, so keep this reference if you report the problem.";
  }
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
  const errorContext = extractStructuredErrorContext(
    error,
    "We couldn't render this part of the experience.",
  );
  const details = getErrorDetails(
    errorContext.message,
    errorContext.statusCode,
    {
      category: errorContext.category,
      retryable: errorContext.retryable,
      recoverySuggestions: errorContext.recoverySuggestions,
    },
  );

  return {
    heading: "Something went wrong",
    message: details.userMessage,
    category: details.category,
    retryDelayMs: details.retryDelayMs,
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
    componentStack?: string;
    debugRoute?: string;
    error?: Error | null;
    incidentStatus?: ErrorReportDurabilityStatus;
    onRetry?: () => void | Promise<void>;
    retryLabel?: string;
    allowRetryWhenNonRetryable?: boolean;
    homeHref?: string;
    digest?: string;
    incidentReference?: string;
  }>,
) {
  const model = buildErrorFallbackModel(props.error ?? null);
  const incidentReference = props.incidentReference?.trim();
  const shouldPreserveResetForUnknownFailure = model.category === "unknown";
  const shouldShowRetry =
    typeof props.onRetry === "function" &&
    (model.retryable ||
      props.allowRetryWhenNonRetryable === true ||
      shouldPreserveResetForUnknownFailure);
  const incidentStatus = props.incidentStatus ?? "unconfirmed";
  const fallbackPanelId = useId();
  const messageId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const retryReenableTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryBlockedUntil, setRetryBlockedUntil] = useState<number>(0);
  const devDetailsVisible =
    process.env.NODE_ENV !== "production" &&
    Boolean(
      props.error?.message ||
      props.digest ||
      props.debugRoute ||
      props.componentStack,
    );

  const isRetryBlocked = isRetrying || retryBlockedUntil > Date.now();

  useEffect(() => {
    if (retryBlockedUntil <= Date.now()) {
      return;
    }

    retryReenableTimerRef.current = globalThis.setTimeout(() => {
      retryReenableTimerRef.current = null;
      setRetryBlockedUntil(0);
    }, retryBlockedUntil - Date.now());

    return () => {
      if (retryReenableTimerRef.current !== null) {
        globalThis.clearTimeout(retryReenableTimerRef.current);
        retryReenableTimerRef.current = null;
      }
    };
  }, [retryBlockedUntil]);

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  const handleRetry = async () => {
    if (!props.onRetry || isRetryBlocked) {
      return;
    }

    setIsRetrying(true);

    if (typeof model.retryDelayMs === "number" && model.retryDelayMs > 0) {
      setRetryBlockedUntil(Date.now() + model.retryDelayMs);
    }

    try {
      await Promise.resolve(props.onRetry());
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div className="
      flex min-h-screen w-full items-center justify-center bg-linear-to-br from-amber-50/50
      via-white to-amber-100/30 px-4 py-12
      dark:from-[#0C0A10] dark:via-[#110E18] dark:to-[#0C0A10]
    ">
      <section
        ref={panelRef}
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        aria-labelledby={fallbackPanelId}
        aria-describedby={messageId}
        tabIndex={-1}
        className="
          w-full max-w-2xl space-y-10 border border-red-200 bg-white/80 p-8 shadow-2xl
          backdrop-blur-xl
          focus:ring-2 focus:ring-red-500/40 focus:ring-offset-2 focus:ring-offset-background
          focus:outline-none
          dark:border-red-900/60 dark:bg-background/80
        "
      >
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
            <h1
              id={fallbackPanelId}
              className="text-3xl font-bold text-foreground"
            >
              {model.heading}
            </h1>
          </div>
        </div>

        <div className="space-y-5">
          <p id={messageId} className="text-base/relaxed text-foreground/70">
            {model.message}
          </p>

          {incidentReference ? (
            <div className="border border-border/60 bg-background/50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">
                  Incident reference
                </p>
                <span
                  className={cn(
                    "text-xs font-semibold tracking-[0.18em] uppercase",
                    getIncidentStatusTone(incidentStatus),
                  )}
                >
                  {getIncidentStatusLabel(incidentStatus)}
                </span>
              </div>
              <p className="mt-1 font-mono text-sm tracking-wide text-foreground/80">
                {incidentReference}
              </p>
              <p className="mt-2 text-sm/relaxed text-muted-foreground">
                {getIncidentStatusMessage(incidentStatus)}
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
                {props.debugRoute ? (
                  <p>
                    <span className="font-semibold text-foreground">
                      Route:
                    </span>{" "}
                    {props.debugRoute}
                  </p>
                ) : null}
                {props.componentStack ? (
                  <div>
                    <p className="font-semibold text-foreground">
                      Component stack:
                    </p>
                    <pre className="
                      mt-1 overflow-x-auto font-mono text-xs/6 whitespace-pre-wrap
                      text-muted-foreground
                    ">
                      {props.componentStack}
                    </pre>
                  </div>
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
          {shouldShowRetry ? (
            <Button
              variant="default"
              size="lg"
              className={cn("w-full", "sm:max-w-xs")}
              disabled={isRetryBlocked}
              onClick={() => {
                void handleRetry();
              }}
            >
              <RefreshCw className="size-4" />
              {isRetrying ? "Retrying…" : (props.retryLabel ?? "Try Again")}
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
      </section>
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
  private pendingIncidentError: Error | null = null;

  state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    incidentStatus: "unconfirmed",
    incidentReference: undefined,
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
      incidentStatus: "unconfirmed",
      incidentReference: getImmediateIncidentReference(
        (error as Error & { digest?: string }).digest,
      ),
    };
  }

  componentWillUnmount() {
    this.pendingIncidentError = null;
  }

  /**
   * Logs the error details to console and analytics for later investigation.
   * @param error - The thrown error.
   * @param errorInfo - React error information that includes the component stack.
   * @source
   */
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const currentRoute =
      globalThis.location === undefined
        ? undefined
        : `${globalThis.location.pathname}${globalThis.location.search}`;
    const immediateIncidentReference =
      this.state.hasError && this.state.error === error
        ? this.state.incidentReference
        : getImmediateIncidentReference(
            (error as Error & { digest?: string }).digest,
          );
    const errorContext = extractStructuredErrorContext(
      error,
      "We couldn't render this part of the experience.",
    );

    this.pendingIncidentError = error;

    this.setState((currentState) => {
      if (!currentState.hasError || currentState.error !== error) {
        return null;
      }

      const nextDebugRoute = sanitizeErrorReportRoute(currentRoute);
      const nextComponentStack = sanitizeErrorReportStackTrace(
        errorInfo.componentStack ?? undefined,
        {
          maxLength: 600,
        },
      );

      return {
        debugComponentStack: nextComponentStack,
        debugRoute: nextDebugRoute,
      };
    });

    logPrivacySafe(
      "error",
      "ErrorBoundary",
      "React error boundary caught render error",
      {
        boundary: "client_error_boundary",
        errorName: error.name,
        error: error.message,
        incidentReference: immediateIncidentReference,
        route: currentRoute,
        stack: error.stack,
        componentStack: errorInfo.componentStack ?? undefined,
      },
    );

    if (process.env.NODE_ENV === "development") {
      console.error("[ErrorBoundary] Caught error:", error, errorInfo);
    }

    void reportStructuredError({
      id: immediateIncidentReference,
      source: "react_error_boundary",
      userAction: "render_component_tree",
      error,
      category: errorContext.category,
      retryable: errorContext.retryable,
      recoverySuggestions: errorContext.recoverySuggestions,
      statusCode: errorContext.statusCode,
      componentStack: errorInfo.componentStack ?? undefined,
      route: currentRoute,
      metadata: {
        boundary: "client_error_boundary",
        initialIncidentReference: immediateIncidentReference,
      },
    }).then((report) => {
      if (!report) {
        return;
      }

      if (
        this.pendingIncidentError !== error ||
        !this.state.hasError ||
        this.state.error !== error
      ) {
        return;
      }

      this.setState((currentState) => {
        if (!currentState.hasError || currentState.error !== error) {
          return null;
        }

        if (currentState.incidentStatus === report.durableStatus) {
          return null;
        }

        return {
          incidentStatus: report.durableStatus,
        };
      });
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
    this.pendingIncidentError = null;

    this.setState(
      {
        hasError: false,
        error: null,
        debugComponentStack: undefined,
        debugRoute: undefined,
        incidentStatus: "unconfirmed",
        incidentReference: undefined,
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
        componentStack={this.state.debugComponentStack}
        debugRoute={this.state.debugRoute}
        error={this.state.error}
        incidentReference={this.state.incidentReference}
        incidentStatus={this.state.incidentStatus}
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
