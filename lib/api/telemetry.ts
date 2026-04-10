import { redisClient } from "@/lib/api/clients";
import { logPrivacySafe } from "@/lib/api/logging";

type AnalyticsRedisPipeline = {
  incr: (key: string) => AnalyticsRedisPipeline;
  expire: (key: string, seconds: number) => AnalyticsRedisPipeline;
  exec: () => Promise<unknown>;
};

type RequestContextWaitUntil = (promise: Promise<unknown>) => void;

type NextRequestContextValue = {
  waitUntil?: RequestContextWaitUntil;
};

type NextRequestContext = {
  get?: () => NextRequestContextValue | undefined;
};

const TELEMETRY_TEST_ENV_FLAG = "ANICARDS_UNIT_TEST";
const pendingTelemetryTasks = new Set<Promise<void>>();

type UnitTestTelemetryGlobals = typeof globalThis & {
  ANICARDS_UNIT_TEST?: boolean;
  ANICARDS_UNIT_TEST_RUNTIME?: boolean;
};

type TelemetryTaskSchedulingOptions = {
  endpoint?: string;
  forceRequestContext?: boolean;
  request?: Request;
  taskName?: string;
};

export const ANALYTICS_COUNTER_TTL_SECONDS = 400 * 24 * 60 * 60;

export function isUnitTestRuntime(): boolean {
  const unitTestGlobals = globalThis as UnitTestTelemetryGlobals;
  if (unitTestGlobals.ANICARDS_UNIT_TEST_RUNTIME === true) {
    return true;
  }

  if (typeof unitTestGlobals.ANICARDS_UNIT_TEST === "boolean") {
    return unitTestGlobals.ANICARDS_UNIT_TEST;
  }

  return (
    process.env[TELEMETRY_TEST_ENV_FLAG] === "true" ||
    process.env.NODE_ENV === "test"
  );
}

function trackPendingTelemetryTaskForTests(task: Promise<void>): void {
  pendingTelemetryTasks.add(task);
  task.finally(() => {
    pendingTelemetryTasks.delete(task);
  });
}

function getRequestContextWaitUntil(): RequestContextWaitUntil | undefined {
  const requestContext = (
    globalThis as typeof globalThis & {
      [key: symbol]: NextRequestContext | undefined;
    }
  )[Symbol.for("@next/request-context")];

  const waitUntil = requestContext?.get?.()?.waitUntil;
  return typeof waitUntil === "function" ? waitUntil : undefined;
}

function createDeferredTelemetryTask(task: () => Promise<void>): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  }).then(task);
}

export async function flushScheduledTelemetryTasksForTests(): Promise<void> {
  while (pendingTelemetryTasks.size > 0) {
    await Promise.allSettled(pendingTelemetryTasks);
  }
}

export function scheduleTelemetryTask(
  task: () => Promise<unknown> | void,
  options?: TelemetryTaskSchedulingOptions,
): void {
  const taskName = options?.taskName ?? "scheduled telemetry task";
  const endpoint = options?.endpoint ?? "Telemetry";
  const forceRequestContext = options?.forceRequestContext ?? false;
  const isTrackedUnitTestRuntime = isUnitTestRuntime();

  const runTask = async () => {
    try {
      await task();
    } catch (error) {
      logPrivacySafe(
        "warn",
        endpoint,
        "Scheduled telemetry task failed",
        {
          taskName,
          error: error instanceof Error ? error.message : String(error),
        },
        options?.request,
      );
    }
  };

  if (!forceRequestContext && isTrackedUnitTestRuntime) {
    const pendingTask = runTask();
    trackPendingTelemetryTaskForTests(pendingTask);
    return;
  }

  const waitUntil = getRequestContextWaitUntil();
  if (waitUntil) {
    let shouldRunDeferredTask = true;
    const pendingTask = createDeferredTelemetryTask(async () => {
      if (!shouldRunDeferredTask) {
        return;
      }

      await runTask();
    });

    if (isTrackedUnitTestRuntime) {
      trackPendingTelemetryTaskForTests(pendingTask);
    }

    try {
      waitUntil(pendingTask);
      return;
    } catch (error) {
      shouldRunDeferredTask = false;
      logPrivacySafe(
        "warn",
        endpoint,
        "Falling back to immediate telemetry scheduling",
        {
          taskName,
          error: error instanceof Error ? error.message : String(error),
        },
        options?.request,
      );

      const fallbackTask = runTask();
      if (isTrackedUnitTestRuntime) {
        trackPendingTelemetryTaskForTests(fallbackTask);
        return;
      }

      return;
    }
  }

  const pendingTask = runTask();
  if (isTrackedUnitTestRuntime) {
    trackPendingTelemetryTaskForTests(pendingTask);
    return;
  }
}

/**
 * Build a canonical analytics Redis key using a stable endpoint key.
 */
export function buildAnalyticsMetricKey(
  endpointKey: string,
  metric: string,
  extraSuffix?: string,
): string {
  const normalized = String(endpointKey).toLowerCase().replaceAll(/\s+/g, "_");
  const base = `analytics:${normalized}:${metric}`;
  return extraSuffix ? `${base}:${extraSuffix}` : base;
}

export function buildAnalyticsStorageKey(
  metric: string,
  now: Date = new Date(),
): string {
  if (/^analytics:.+:month:\d{4}-\d{2}$/.test(metric)) {
    return metric;
  }

  return `${metric}:month:${now.toISOString().slice(0, 7)}`;
}

export async function incrementAnalytics(
  metric: string,
  options?: { now?: Date },
): Promise<void> {
  const storageKey = buildAnalyticsStorageKey(metric, options?.now);

  try {
    await redisClient.incr(storageKey);
    await redisClient.expire(storageKey, ANALYTICS_COUNTER_TTL_SECONDS);
  } catch (error) {
    logPrivacySafe("warn", "Analytics", "Failed to increment analytics", {
      metric,
      storageKey,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function incrementAnalyticsBatch(
  metrics: Iterable<string>,
  options?: { now?: Date },
): Promise<void> {
  const storageKeys = Array.from(metrics, (metric) =>
    buildAnalyticsStorageKey(metric, options?.now),
  );

  if (storageKeys.length === 0) {
    return;
  }

  try {
    const pipeline =
      redisClient.pipeline() as unknown as AnalyticsRedisPipeline;

    for (const storageKey of storageKeys) {
      pipeline.incr(storageKey);
      pipeline.expire(storageKey, ANALYTICS_COUNTER_TTL_SECONDS);
    }

    await pipeline.exec();
  } catch (error) {
    logPrivacySafe("warn", "Analytics", "Failed to increment analytics batch", {
      metricCount: storageKeys.length,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
