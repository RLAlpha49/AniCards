import type { NextResponse } from "next/server";

import {
  type ApiError,
  invalidJsonResponse,
  payloadTooLargeResponse,
} from "@/lib/api/errors";
import { logPrivacySafe } from "@/lib/api/logging";
import {
  buildAnalyticsMetricKey,
  incrementAnalytics,
  scheduleTelemetryTask,
} from "@/lib/api/telemetry";

const DEFAULT_JSON_BODY_LIMIT_BYTES = 512 * 1024;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) {
    return `${Math.round((bytes / 1024) * 10) / 10} KB`;
  }

  return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`;
}

function readContentLengthHeader(request: Request): number | undefined {
  const rawValue = request.headers.get("content-length")?.trim();
  if (!rawValue) {
    return undefined;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return undefined;
  }

  return parsed;
}

function getUtf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

export type ReadJsonRequestBodyResult<T> =
  | { success: true; data: T }
  | {
      success: false;
      errorResponse: NextResponse<ApiError & Record<string, unknown>>;
    };

export async function readJsonRequestBody<T>(
  request: Request,
  options: {
    endpointName: string;
    endpointKey: string;
    maxBytes?: number;
  },
): Promise<ReadJsonRequestBodyResult<T>> {
  const maxBytes =
    typeof options.maxBytes === "number" && options.maxBytes > 0
      ? options.maxBytes
      : DEFAULT_JSON_BODY_LIMIT_BYTES;

  const contentLength = readContentLengthHeader(request);
  if (typeof contentLength === "number" && contentLength > maxBytes) {
    logPrivacySafe(
      "warn",
      options.endpointName,
      "Rejected request body larger than configured limit from Content-Length header.",
      {
        contentLength,
        maxBytes,
      },
      request,
    );

    const metric = buildAnalyticsMetricKey(
      options.endpointKey,
      "failed_requests",
    );
    scheduleTelemetryTask(() => incrementAnalytics(metric), {
      endpoint: options.endpointName,
      taskName: metric,
      request,
    });

    return {
      success: false,
      errorResponse: payloadTooLargeResponse(request, { maxBytes }),
    };
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    const metric = buildAnalyticsMetricKey(
      options.endpointKey,
      "failed_requests",
    );
    scheduleTelemetryTask(() => incrementAnalytics(metric), {
      endpoint: options.endpointName,
      taskName: metric,
      request,
    });

    return {
      success: false,
      errorResponse: invalidJsonResponse(request),
    };
  }

  const actualBytes = getUtf8ByteLength(rawBody);
  if (actualBytes > maxBytes) {
    logPrivacySafe(
      "warn",
      options.endpointName,
      "Rejected request body larger than configured limit after reading body.",
      {
        contentLength,
        actualBytes,
        maxBytes,
        maxSize: formatBytes(maxBytes),
      },
      request,
    );

    const metric = buildAnalyticsMetricKey(
      options.endpointKey,
      "failed_requests",
    );
    scheduleTelemetryTask(() => incrementAnalytics(metric), {
      endpoint: options.endpointName,
      taskName: metric,
      request,
    });

    return {
      success: false,
      errorResponse: payloadTooLargeResponse(request, { maxBytes }),
    };
  }

  try {
    return {
      success: true,
      data: JSON.parse(rawBody) as T,
    };
  } catch {
    const metric = buildAnalyticsMetricKey(
      options.endpointKey,
      "failed_requests",
    );
    scheduleTelemetryTask(() => incrementAnalytics(metric), {
      endpoint: options.endpointName,
      taskName: metric,
      request,
    });

    return {
      success: false,
      errorResponse: invalidJsonResponse(request),
    };
  }
}
