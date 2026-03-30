import { errorReportPayloadSchema } from "@/lib/api/validation";
import {
  apiErrorResponse,
  apiJsonHeaders,
  createRateLimiter,
  initializeApiRequest,
  invalidJsonResponse,
  jsonWithCors,
  scheduleTelemetryTask,
} from "@/lib/api-utils";
import {
  type ErrorReportSource,
  reportStructuredError,
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
    { requireOrigin: true },
  );
  if (init.errorResponse) return init.errorResponse;

  const { requestId: ingestionRequestId } = init;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return invalidJsonResponse(request);
  }

  const parsedPayload = errorReportPayloadSchema.safeParse(payload);
  if (!parsedPayload.success) {
    return apiErrorResponse(request, 400, "Invalid error report payload", {
      category: "invalid_data",
      retryable: false,
    });
  }

  const reportPayload = parsedPayload.data;

  scheduleTelemetryTask(
    () =>
      reportStructuredError({
        source:
          (reportPayload.source as ErrorReportSource | undefined) ??
          "client_hook",
        userAction: reportPayload.userAction,
        error: reportPayload.message,
        requestId: reportPayload.requestId ?? ingestionRequestId,
        errorName: reportPayload.errorName,
        route: reportPayload.route,
        statusCode: reportPayload.statusCode,
        digest: reportPayload.digest,
        stack: reportPayload.stack,
        componentStack: reportPayload.componentStack,
        metadata: reportPayload.metadata,
      }),
    {
      endpoint: "Error Reports API",
      taskName: "reportStructuredError",
      request,
    },
  );

  return jsonWithCors({ accepted: true }, request, 202);
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
