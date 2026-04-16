import { apiJsonHeaders, jsonWithCors } from "@/lib/api/cors";
import { apiErrorResponse, handleError } from "@/lib/api/errors";
import { logPrivacySafe } from "@/lib/api/logging";
import { createRateLimiter } from "@/lib/api/rate-limit";
import { readJsonRequestBody } from "@/lib/api/request-body";
import { initializeApiRequest } from "@/lib/api/request-guards";
import {
  buildAnalyticsMetricKey,
  incrementAnalytics,
  incrementAnalyticsBatch,
  scheduleTelemetryTask,
} from "@/lib/api/telemetry";
import { errorReportPayloadSchema } from "@/lib/api/validation";
import {
  ERROR_REPORT_REQUEST_MAX_BYTES,
  type ErrorReportSource,
  recordStructuredErrorOrThrow,
} from "@/lib/error-tracking";

const ACCEPTED_ERROR_REPORTS_METRIC = "accepted_reports";
const REJECTED_ERROR_REPORTS_METRIC = "rejected_reports";
const MAX_REJECTION_ISSUE_FIELDS = 4;
const TRACKED_ERROR_REPORT_SOURCES = new Set<ErrorReportSource>([
  "user_action",
  "client_hook",
  "analytics_instrumentation",
  "react_error_boundary",
  "app_router_error_boundary",
  "api_route",
]);

const errorReportsRateLimiter = createRateLimiter({
  limit: 3,
  window: "10 s",
  prefix: "error-reports",
});

function resolveErrorReportSource(
  value: unknown,
): ErrorReportSource | "unknown" {
  if (typeof value !== "string") {
    return "unknown";
  }

  return TRACKED_ERROR_REPORT_SOURCES.has(value as ErrorReportSource)
    ? (value as ErrorReportSource)
    : "unknown";
}

function buildAcceptedErrorReportMetrics(
  endpointKey: string,
  report: {
    category: string;
    source: ErrorReportSource;
  },
): string[] {
  return [
    buildAnalyticsMetricKey(endpointKey, ACCEPTED_ERROR_REPORTS_METRIC),
    buildAnalyticsMetricKey(
      endpointKey,
      ACCEPTED_ERROR_REPORTS_METRIC,
      `source:${report.source}`,
    ),
    buildAnalyticsMetricKey(
      endpointKey,
      ACCEPTED_ERROR_REPORTS_METRIC,
      `category:${report.category}`,
    ),
  ];
}

function buildRejectedErrorReportBreadcrumb(
  payload: Record<string, unknown>,
  issues: Array<{
    path: PropertyKey[];
  }>,
  requestId: string | undefined,
): Record<string, unknown> {
  const issueFields = Array.from(
    new Set(
      issues
        .map((issue) => issue.path[0])
        .filter(
          (segment): segment is string =>
            typeof segment === "string" && segment.length > 0,
        ),
    ),
  ).slice(0, MAX_REJECTION_ISSUE_FIELDS);

  return {
    source: resolveErrorReportSource(payload.source),
    ...(typeof payload.userAction === "string"
      ? { userAction: payload.userAction }
      : {}),
    ...(requestId ? { requestId } : {}),
    ...(typeof payload.operationId === "string"
      ? { operationId: payload.operationId }
      : {}),
    issueCount: issues.length,
    ...(issueFields.length > 0 ? { issueFields: issueFields.join(",") } : {}),
  };
}

export async function POST(request: Request) {
  const init = await initializeApiRequest(
    request,
    "Error Reports API",
    "error_reports",
    errorReportsRateLimiter,
    {
      requireOrigin: true,
      requireRequestProof: true,
      requireVerifiedClientIp: true,
    },
  );
  if (init.errorResponse) return init.errorResponse;

  const {
    endpoint,
    endpointKey,
    operationId: ingestionOperationId,
    requestId: ingestionRequestId,
    startTime,
  } = init;

  const bodyResult = await readJsonRequestBody<Record<string, unknown>>(
    request,
    {
      endpointName: endpoint,
      endpointKey,
      maxBytes: ERROR_REPORT_REQUEST_MAX_BYTES,
    },
  );
  if (!bodyResult.success) {
    return bodyResult.errorResponse;
  }

  const payload = bodyResult.data;

  const parsedPayload = errorReportPayloadSchema.safeParse(payload);
  if (!parsedPayload.success) {
    const rejectMetric = buildAnalyticsMetricKey(
      endpointKey,
      REJECTED_ERROR_REPORTS_METRIC,
    );
    const rejectionBreadcrumb = buildRejectedErrorReportBreadcrumb(
      payload,
      parsedPayload.error.issues,
      typeof payload.requestId === "string"
        ? payload.requestId
        : ingestionRequestId,
    );

    logPrivacySafe(
      "warn",
      endpoint,
      "Rejected invalid error report payload",
      rejectionBreadcrumb,
      request,
    );
    scheduleTelemetryTask(
      () =>
        incrementAnalytics(rejectMetric, {
          endpoint,
          logContext: rejectionBreadcrumb,
          request,
        }),
      {
        endpoint,
        taskName: rejectMetric,
        request,
      },
    );

    return apiErrorResponse(request, 400, "Invalid error report payload", {
      category: "invalid_data",
      retryable: false,
    });
  }

  const reportPayload = parsedPayload.data;
  const source =
    (reportPayload.source as ErrorReportSource | undefined) ?? "client_hook";
  const requestId = reportPayload.requestId ?? ingestionRequestId;
  let recordedReport;

  try {
    recordedReport = await recordStructuredErrorOrThrow({
      id: reportPayload.id,
      source,
      userAction: reportPayload.userAction,
      error: reportPayload.message,
      category: reportPayload.category,
      retryable: reportPayload.retryable,
      recoverySuggestions: reportPayload.recoverySuggestions,
      requestId,
      operationId: reportPayload.operationId ?? ingestionOperationId,
      errorName: reportPayload.errorName,
      route: reportPayload.route,
      statusCode: reportPayload.statusCode,
      digest: reportPayload.digest,
      stack: reportPayload.stack,
      componentStack: reportPayload.componentStack,
      metadata: reportPayload.metadata,
      timestamp: reportPayload.timestamp,
    });
  } catch (error) {
    return handleError(
      error instanceof Error ? error : new Error(String(error)),
      endpoint,
      startTime,
      buildAnalyticsMetricKey(endpointKey, "failed_requests"),
      "Failed to record error report",
      request,
      {
        redisUnavailableMessage:
          "Structured error reporting is temporarily unavailable",
        logContext: {
          userAction: reportPayload.userAction,
          source,
          requestId,
        },
      },
    );
  }

  const acceptedMetrics = buildAcceptedErrorReportMetrics(
    endpointKey,
    recordedReport,
  );
  const acceptedBreadcrumb = {
    source: recordedReport.source,
    category: recordedReport.category,
    userAction: recordedReport.userAction,
    ...(recordedReport.requestId
      ? { requestId: recordedReport.requestId }
      : {}),
    ...(recordedReport.operationId
      ? { operationId: recordedReport.operationId }
      : {}),
  };

  scheduleTelemetryTask(
    () =>
      incrementAnalyticsBatch(acceptedMetrics, {
        endpoint,
        logContext: acceptedBreadcrumb,
        request,
      }),
    {
      endpoint,
      taskName: acceptedMetrics[0],
      request,
    },
  );

  return jsonWithCors({ recorded: true }, request, 200);
}

export function OPTIONS(request: Request) {
  const headers = apiJsonHeaders(request);
  return new Response(null, {
    headers: {
      ...headers,
      "Access-Control-Allow-Headers": "Content-Type, X-Request-Id",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
  });
}
