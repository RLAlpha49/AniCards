import { generateSecureId } from "@/lib/utils";

export interface ApiRequestContext {
  requestId: string;
  operationId: string;
  method: string;
  path: string;
  ip?: string;
  endpoint?: string;
  endpointKey?: string;
}

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{8,120}$/;
const REQUEST_ID_HEADER = "X-Request-Id";
const OPERATION_ID_HEADER = "X-Operation-Id";
const apiRequestContextStore = new WeakMap<Request, ApiRequestContext>();

function isSafeRequestId(value: string): boolean {
  return REQUEST_ID_PATTERN.test(value);
}

function isSafeOperationId(value: string): boolean {
  return REQUEST_ID_PATTERN.test(value);
}

function createRequestId(): string {
  if (typeof crypto?.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return generateSecureId("request");
}

function createOperationId(): string {
  return generateSecureId("op");
}

function getRequestPath(request: Request): string {
  try {
    return new URL(request.url).pathname;
  } catch {
    return request.url;
  }
}

function resolveProvidedRequestId(
  value: string | null | undefined,
): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed || !isSafeRequestId(trimmed)) {
    return undefined;
  }

  return trimmed;
}

function resolveProvidedOperationId(
  value: string | null | undefined,
): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed || !isSafeOperationId(trimmed)) {
    return undefined;
  }

  return trimmed;
}

function mergeHeaderList(
  existingValue: string | undefined,
  entryToAdd: string,
): string {
  const mergedEntries = new Map<string, string>();

  for (const entry of (existingValue ?? "").split(",")) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    mergedEntries.set(trimmed.toLowerCase(), trimmed);
  }

  mergedEntries.set(entryToAdd.toLowerCase(), entryToAdd);
  return [...mergedEntries.values()].join(", ");
}

export function ensureRequestContext(
  request: Request,
  options?: Partial<Omit<ApiRequestContext, "requestId" | "operationId">> & {
    requestId?: string;
    operationId?: string;
  },
): ApiRequestContext {
  const existing = apiRequestContextStore.get(request);
  const requestId =
    resolveProvidedRequestId(options?.requestId) ??
    resolveProvidedRequestId(request.headers.get(REQUEST_ID_HEADER)) ??
    resolveProvidedRequestId(
      request.headers.get(REQUEST_ID_HEADER.toLowerCase()),
    ) ??
    existing?.requestId ??
    createRequestId();
  const operationId =
    resolveProvidedOperationId(options?.operationId) ??
    resolveProvidedOperationId(request.headers.get(OPERATION_ID_HEADER)) ??
    resolveProvidedOperationId(
      request.headers.get(OPERATION_ID_HEADER.toLowerCase()),
    ) ??
    existing?.operationId ??
    createOperationId();

  const nextContext: ApiRequestContext = {
    requestId,
    operationId,
    method: options?.method ?? existing?.method ?? request.method,
    path: options?.path ?? existing?.path ?? getRequestPath(request),
    ...((options?.ip ?? existing?.ip)
      ? { ip: options?.ip ?? existing?.ip }
      : {}),
    ...((options?.endpoint ?? existing?.endpoint)
      ? { endpoint: options?.endpoint ?? existing?.endpoint }
      : {}),
    ...((options?.endpointKey ?? existing?.endpointKey)
      ? { endpointKey: options?.endpointKey ?? existing?.endpointKey }
      : {}),
  };

  apiRequestContextStore.set(request, nextContext);
  return nextContext;
}

export function getRequestContext(
  request?: Request,
): ApiRequestContext | undefined {
  if (!request) {
    return undefined;
  }

  return apiRequestContextStore.get(request);
}

export function getRequestId(request?: Request): string | undefined {
  if (!request) {
    return undefined;
  }

  return (
    apiRequestContextStore.get(request)?.requestId ??
    resolveProvidedRequestId(request.headers.get(REQUEST_ID_HEADER)) ??
    resolveProvidedRequestId(
      request.headers.get(REQUEST_ID_HEADER.toLowerCase()),
    )
  );
}

export function getOperationId(request?: Request): string | undefined {
  if (!request) {
    return undefined;
  }

  return (
    apiRequestContextStore.get(request)?.operationId ??
    resolveProvidedOperationId(request.headers.get(OPERATION_ID_HEADER)) ??
    resolveProvidedOperationId(
      request.headers.get(OPERATION_ID_HEADER.toLowerCase()),
    )
  );
}

export function withRequestIdHeaders(
  headers: Record<string, string>,
  request?: Request,
  requestId?: string,
): Record<string, string> {
  const effectiveRequestId = requestId ?? getRequestId(request);
  if (!effectiveRequestId) {
    return headers;
  }

  return {
    ...headers,
    [REQUEST_ID_HEADER]: effectiveRequestId,
    "Access-Control-Expose-Headers": mergeHeaderList(
      headers["Access-Control-Expose-Headers"],
      REQUEST_ID_HEADER,
    ),
  };
}
