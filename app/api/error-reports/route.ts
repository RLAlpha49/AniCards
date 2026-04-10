import { apiJsonHeaders, jsonWithCors } from "@/lib/api/cors";
import { apiErrorResponse, handleError } from "@/lib/api/errors";
import { createRateLimiter } from "@/lib/api/rate-limit";
import { readJsonRequestBody } from "@/lib/api/request-body";
import { initializeApiRequest } from "@/lib/api/request-guards";
import { buildAnalyticsMetricKey } from "@/lib/api/telemetry";
import { errorReportPayloadSchema } from "@/lib/api/validation";
import {
  ERROR_REPORT_REQUEST_MAX_BYTES,
  type ErrorReportSource,
  recordStructuredErrorOrThrow,
} from "@/lib/error-tracking";

const errorReportsRateLimiter = createRateLimiter({
  limit: 3,
  window: "10 s",
  prefix: "error-reports",
});

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
    return apiErrorResponse(request, 400, "Invalid error report payload", {
      category: "invalid_data",
      retryable: false,
    });
  }

  const reportPayload = parsedPayload.data;
  const source =
    (reportPayload.source as ErrorReportSource | undefined) ?? "client_hook";
  const requestId = reportPayload.requestId ?? ingestionRequestId;

  try {
    await recordStructuredErrorOrThrow({
      source,
      userAction: reportPayload.userAction,
      error: reportPayload.message,
      category: reportPayload.category,
      retryable: reportPayload.retryable,
      recoverySuggestions: reportPayload.recoverySuggestions,
      requestId,
      errorName: reportPayload.errorName,
      route: reportPayload.route,
      statusCode: reportPayload.statusCode,
      digest: reportPayload.digest,
      stack: reportPayload.stack,
      componentStack: reportPayload.componentStack,
      metadata: reportPayload.metadata,
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
