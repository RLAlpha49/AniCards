// lib/api/request-body.ts
//
// Reads JSON bodies at the API boundary with consistent size enforcement, telemetry,
// and privacy-safe logging. It fails early on oversized `Content-Length` headers and
// then enforces the same byte ceiling while streaming the body so callers stay
// protected when clients omit or lie about the header.
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

async function cancelRequestBodyReader(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): Promise<void> {
  try {
    await reader.cancel();
  } catch {
    // Best-effort only. The request is already being rejected.
  }
}

async function readRequestBodyTextWithinLimit(
  request: Request,
  options: {
    contentLength?: number;
    endpointKey: string;
    endpointName: string;
    maxBytes: number;
  },
): Promise<
  | { success: true; rawBody: string }
  | {
      success: false;
      errorResponse: NextResponse<ApiError & Record<string, unknown>>;
    }
> {
  if (!request.body) {
    return {
      success: true,
      rawBody: "",
    };
  }

  let reader: ReadableStreamDefaultReader<Uint8Array>;
  try {
    reader = request.body.getReader();
  } catch {
    scheduleFailedRequestMetric(request, {
      endpointKey: options.endpointKey,
      endpointName: options.endpointName,
      reasonCode: "invalid_json",
    });

    return {
      success: false,
      errorResponse: invalidJsonResponse(request),
    };
  }

  const decoder = new TextDecoder();
  const bodyParts: string[] = [];
  let actualBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        bodyParts.push(decoder.decode());
        break;
      }

      actualBytes += value.byteLength;
      if (actualBytes > options.maxBytes) {
        logPrivacySafe(
          "warn",
          options.endpointName,
          "Rejected request body larger than configured limit while streaming body.",
          {
            contentLength: options.contentLength,
            actualBytes,
            maxBytes: options.maxBytes,
            maxSize: formatBytes(options.maxBytes),
          },
          request,
        );

        scheduleFailedRequestMetric(request, {
          endpointKey: options.endpointKey,
          endpointName: options.endpointName,
          reasonCode: "payload_too_large",
        });

        await cancelRequestBodyReader(reader);

        return {
          success: false,
          errorResponse: payloadTooLargeResponse(request, {
            maxBytes: options.maxBytes,
          }),
        };
      }

      bodyParts.push(decoder.decode(value, { stream: true }));
    }
  } catch {
    await cancelRequestBodyReader(reader);

    scheduleFailedRequestMetric(request, {
      endpointKey: options.endpointKey,
      endpointName: options.endpointName,
      reasonCode: "invalid_json",
    });

    return {
      success: false,
      errorResponse: invalidJsonResponse(request),
    };
  } finally {
    reader.releaseLock();
  }

  return {
    success: true,
    rawBody: bodyParts.join(""),
  };
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
 * The parser checks `Content-Length` first for a cheap reject, then enforces the
 * same ceiling while streaming the request body so oversized payloads cannot
 * bypass the limit by omitting or understating the header.
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

  const rawBodyResult = await readRequestBodyTextWithinLimit(request, {
    contentLength,
    endpointKey: options.endpointKey,
    endpointName: options.endpointName,
    maxBytes,
  });
  if (!rawBodyResult.success) {
    return rawBodyResult;
  }

  try {
    return {
      success: true,
      data: JSON.parse(rawBodyResult.rawBody) as T,
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
