// lib/api/request-body.ts
//
// Reads JSON bodies at the API boundary with consistent size enforcement, telemetry,
// and privacy-safe logging. It fails early on oversized `Content-Length` headers and
// double-checks the actual UTF-8 body size so callers stay protected when clients omit
// or lie about the header.
//
// Centralizing this keeps every route handler aligned on malformed-body behavior.

import type { NextResponse } from "next/server";

import {
  type ApiError,
  invalidJsonResponse,
  payloadTooLargeResponse,
} from "@/lib/api/errors";
import { logPrivacySafe } from "@/lib/api/logging";
import {
  buildFailedRequestMetricKeys,
  scheduleLowValueAnalyticsBatch,
} from "@/lib/api/telemetry";

const DEFAULT_JSON_BODY_LIMIT_BYTES = 512 * 1024;

function scheduleFailedRequestMetric(
  request: Request,
  options: {
    endpointKey: string;
    endpointName: string;
    reasonCode: string;
  },
): void {
  const metrics = buildFailedRequestMetricKeys(
    options.endpointKey,
    options.reasonCode,
  );
  scheduleLowValueAnalyticsBatch(metrics, {
    endpoint: options.endpointName,
    request,
    taskName: metrics[0],
  });
}

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

/**
 * Result shape returned by `readJsonRequestBody` so callers can short-circuit with a typed error response.
 */
export type ReadJsonRequestBodyResult<T> =
  | { success: true; data: T }
  | {
      success: false;
      errorResponse: NextResponse<ApiError & Record<string, unknown>>;
    };

/**
 * Parses a JSON request body while enforcing a byte limit.
 *
 * The parser checks `Content-Length` first for a cheap reject, then measures the
 * actual UTF-8 payload after reading so oversized bodies cannot bypass the limit
 * by omitting or understating the header.
 */
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

    scheduleFailedRequestMetric(request, {
      ...options,
      reasonCode: "payload_too_large",
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
    scheduleFailedRequestMetric(request, {
      ...options,
      reasonCode: "invalid_json",
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

    scheduleFailedRequestMetric(request, {
      ...options,
      reasonCode: "payload_too_large",
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
    scheduleFailedRequestMetric(request, {
      ...options,
      reasonCode: "invalid_json",
    });

    return {
      success: false,
      errorResponse: invalidJsonResponse(request),
    };
  }
}
