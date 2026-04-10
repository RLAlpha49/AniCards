import { parseResponsePayload } from "@/lib/utils";

const DEFAULT_CLIENT_REQUEST_TIMEOUT_MS = 15_000;

export interface ClientJsonRequestOptions extends Omit<RequestInit, "signal"> {
  signal?: AbortSignal;
  timeoutMs?: number;
}

function toAbortReason(reason: unknown, name: "AbortError" | "TimeoutError") {
  if (reason instanceof DOMException) {
    return reason;
  }

  if (reason instanceof Error) {
    return reason;
  }

  return new DOMException(
    name === "TimeoutError"
      ? "The request timed out."
      : "The request was aborted.",
    name,
  );
}

function createAbortContext(timeoutMs: number, signal?: AbortSignal) {
  const controller = new AbortController();
  let abortListener: (() => void) | undefined;

  if (signal) {
    if (signal.aborted) {
      controller.abort(toAbortReason(signal.reason, "AbortError"));
    } else {
      abortListener = () => {
        controller.abort(toAbortReason(signal.reason, "AbortError"));
      };
      signal.addEventListener("abort", abortListener, { once: true });
    }
  }

  const timeoutId = globalThis.setTimeout(() => {
    controller.abort(
      new DOMException(
        `Request timed out after ${timeoutMs}ms`,
        "TimeoutError",
      ),
    );
  }, timeoutMs);

  return {
    signal: controller.signal,
    cleanup: () => {
      globalThis.clearTimeout(timeoutId);
      if (signal && abortListener) {
        signal.removeEventListener("abort", abortListener);
      }
    },
  };
}

export function isClientAbortError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  );
}

export function isClientRequestCancelled(
  error: unknown,
  signal?: AbortSignal,
): boolean {
  return Boolean(signal?.aborted) && isClientAbortError(error);
}

export function isClientTimeoutError(error: unknown): boolean {
  return error instanceof Error && error.name === "TimeoutError";
}

export function throwIfClientRequestAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) {
    return;
  }

  throw toAbortReason(signal.reason, "AbortError");
}

export async function requestClientJson(
  input: RequestInfo | URL,
  options: ClientJsonRequestOptions = {},
): Promise<{ response: Response; payload: unknown }> {
  const {
    timeoutMs = DEFAULT_CLIENT_REQUEST_TIMEOUT_MS,
    signal,
    ...requestInit
  } = options;

  throwIfClientRequestAborted(signal);

  const abortContext = createAbortContext(timeoutMs, signal);

  try {
    const response = await fetch(input, {
      ...requestInit,
      signal: abortContext.signal,
    });
    const payload = await parseResponsePayload(response);

    return {
      response,
      payload,
    };
  } finally {
    abortContext.cleanup();
  }
}
