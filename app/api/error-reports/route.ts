import {
  apiErrorResponse,
  apiJsonHeaders,
  createRateLimiter,
  initializeApiRequest,
  invalidJsonResponse,
  jsonWithCors,
} from "@/lib/api-utils";
import {
  type ErrorReportSource,
  reportStructuredError,
} from "@/lib/error-tracking";

const ALLOWED_SOURCES = new Set<ErrorReportSource>([
  "user_action",
  "client_hook",
  "react_error_boundary",
  "app_router_error_boundary",
  "api_route",
]);

const errorReportsRateLimiter = createRateLimiter({
  limit: 3,
  window: "10 s",
  prefix: "error-reports",
});
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{8,120}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getOptionalString(
  value: unknown,
  maxLength = 2_000,
): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLength);
}

function getOptionalInteger(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return undefined;
  }

  return value >= 400 && value <= 599 ? value : undefined;
}

function getOptionalRequestId(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();
  if (!REQUEST_ID_PATTERN.test(trimmed)) {
    return undefined;
  }

  return trimmed;
}

function getOptionalSource(value: unknown): ErrorReportSource | undefined {
  if (typeof value !== "string") return undefined;
  return ALLOWED_SOURCES.has(value as ErrorReportSource)
    ? (value as ErrorReportSource)
    : undefined;
}

function getMetadata(
  value: unknown,
): Record<string, string | number | boolean | null> | undefined {
  if (!isRecord(value)) return undefined;

  const entries = Object.entries(value).flatMap(([key, entryValue]) => {
    if (
      entryValue === null ||
      typeof entryValue === "string" ||
      typeof entryValue === "number" ||
      typeof entryValue === "boolean"
    ) {
      return [[key, entryValue]];
    }

    return [];
  });

  if (entries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(entries);
}

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

  if (!isRecord(payload)) {
    return apiErrorResponse(request, 400, "Invalid error report payload", {
      category: "invalid_data",
      retryable: false,
    });
  }

  const userAction = getOptionalString(payload.userAction, 120);
  const message = getOptionalString(payload.message);

  if (!userAction || !message) {
    return apiErrorResponse(request, 400, "Invalid error report payload", {
      category: "invalid_data",
      retryable: false,
    });
  }

  await reportStructuredError({
    source: getOptionalSource(payload.source) ?? "client_hook",
    userAction,
    error: message,
    requestId: getOptionalRequestId(payload.requestId) ?? ingestionRequestId,
    errorName: getOptionalString(payload.errorName, 120),
    route: getOptionalString(payload.route, 512),
    statusCode: getOptionalInteger(payload.statusCode),
    digest: getOptionalString(payload.digest, 120),
    stack: getOptionalString(payload.stack, 8_000),
    componentStack: getOptionalString(payload.componentStack, 8_000),
    metadata: getMetadata(payload.metadata),
  });

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
