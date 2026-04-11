import { redisClient } from "@/lib/api/clients";
import { logPrivacySafe } from "@/lib/api/logging";

type AnalyticsRedisPipeline = {
  incr: (key: string) => AnalyticsRedisPipeline;
  expire: (key: string, seconds: number) => AnalyticsRedisPipeline;
  sadd: (key: string, ...members: string[]) => AnalyticsRedisPipeline;
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

type AnalyticsIncrementOptions = {
  endpoint?: string;
  logContext?: Record<string, unknown>;
  now?: Date;
  request?: Request;
};

type AnalyticsSchedulingOptions = AnalyticsIncrementOptions &
  Omit<TelemetryTaskSchedulingOptions, "taskName"> & {
    taskName?: string;
  };

type AnalyticsMetricCount = {
  count: number;
  metric: string;
};

type PendingLowValueAnalyticsBatch = {
  endpoint: string;
  logContext?: Record<string, unknown>;
  metrics: Map<string, number>;
  now?: Date;
  request?: Request;
  scheduled: boolean;
};

export const ANALYTICS_COUNTER_TTL_SECONDS = 400 * 24 * 60 * 60;
export const ANALYTICS_REPORTING_INDEX_KEY = "analytics:reporting:index";
const pendingLowValueAnalyticsBatches = new Map<
  string,
  PendingLowValueAnalyticsBatch
>();

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

  pendingLowValueAnalyticsBatches.clear();
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
  options?: AnalyticsIncrementOptions,
): Promise<void> {
  const storageKey = buildAnalyticsStorageKey(metric, options?.now);

  try {
    await redisClient.incr(storageKey);
    await redisClient.expire(storageKey, ANALYTICS_COUNTER_TTL_SECONDS);
    await redisClient.sadd(ANALYTICS_REPORTING_INDEX_KEY, storageKey);
  } catch (error) {
    logPrivacySafe(
      "warn",
      options?.endpoint ?? "Analytics",
      "Failed to increment analytics",
      {
        ...(options?.logContext ?? {}),
        metric,
        storageKey,
        error: error instanceof Error ? error.message : String(error),
      },
      options?.request,
    );
  }
}

export async function incrementAnalyticsBatch(
  metrics: Iterable<string>,
  options?: AnalyticsIncrementOptions,
): Promise<void> {
  const metricList = Array.from(metrics);
  const storageKeys = metricList.map((metric) =>
    buildAnalyticsStorageKey(metric, options?.now),
  );
  const uniqueStorageKeys = [...new Set(storageKeys)];

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

    pipeline.sadd(ANALYTICS_REPORTING_INDEX_KEY, ...uniqueStorageKeys);

    await pipeline.exec();
  } catch (error) {
    logPrivacySafe(
      "warn",
      options?.endpoint ?? "Analytics",
      "Failed to increment analytics batch",
      {
        ...(options?.logContext ?? {}),
        metricCount: metricList.length,
        metricPreview: metricList.slice(0, 3).join(","),
        error: error instanceof Error ? error.message : String(error),
      },
      options?.request,
    );
  }
}

export async function incrementAnalyticsBatchCounts(
  metrics: Iterable<AnalyticsMetricCount>,
  options?: AnalyticsIncrementOptions,
): Promise<void> {
  const metricCounts = Array.from(metrics)
    .map(({ count, metric }) => ({
      count: Math.max(0, Math.trunc(count)),
      metric,
    }))
    .filter(({ count, metric }) => count > 0 && metric.length > 0);

  if (metricCounts.length === 0) {
    return;
  }

  const storageEntries = metricCounts.map(({ count, metric }) => ({
    count,
    metric,
    storageKey: buildAnalyticsStorageKey(metric, options?.now),
  }));
  const uniqueStorageKeys = [
    ...new Set(storageEntries.map(({ storageKey }) => storageKey)),
  ];

  try {
    const pipeline =
      redisClient.pipeline() as unknown as AnalyticsRedisPipeline;

    for (const { count, storageKey } of storageEntries) {
      for (let index = 0; index < count; index += 1) {
        pipeline.incr(storageKey);
      }

      pipeline.expire(storageKey, ANALYTICS_COUNTER_TTL_SECONDS);
    }

    pipeline.sadd(ANALYTICS_REPORTING_INDEX_KEY, ...uniqueStorageKeys);

    await pipeline.exec();
  } catch (error) {
    logPrivacySafe(
      "warn",
      options?.endpoint ?? "Analytics",
      "Failed to increment analytics batch counts",
      {
        ...(options?.logContext ?? {}),
        metricCount: metricCounts.reduce(
          (total, entry) => total + entry.count,
          0,
        ),
        metricPreview: metricCounts
          .slice(0, 3)
          .map(({ count, metric }) =>
            count > 1 ? `${metric}×${String(count)}` : metric,
          )
          .join(","),
        uniqueMetricCount: metricCounts.length,
        error: error instanceof Error ? error.message : String(error),
      },
      options?.request,
    );
  }
}

export function scheduleAnalyticsIncrement(
  metric: string,
  options?: AnalyticsSchedulingOptions,
): void {
  scheduleTelemetryTask(
    () =>
      incrementAnalytics(metric, {
        endpoint: options?.endpoint,
        logContext: options?.logContext,
        now: options?.now,
        request: options?.request,
      }),
    {
      endpoint: options?.endpoint,
      forceRequestContext: options?.forceRequestContext,
      request: options?.request,
      taskName: options?.taskName ?? metric,
    },
  );
}

export function scheduleAnalyticsBatch(
  metrics: Iterable<string>,
  options?: AnalyticsSchedulingOptions,
): void {
  const metricList = Array.from(metrics).filter((metric) => metric.length > 0);

  if (metricList.length === 0) {
    return;
  }

  scheduleTelemetryTask(
    () =>
      incrementAnalyticsBatch(metricList, {
        endpoint: options?.endpoint,
        logContext: options?.logContext,
        now: options?.now,
        request: options?.request,
      }),
    {
      endpoint: options?.endpoint,
      forceRequestContext: options?.forceRequestContext,
      request: options?.request,
      taskName: options?.taskName ?? "analytics batch",
    },
  );
}

export function scheduleDeferredAnalyticsBatch(
  metrics: Iterable<string>,
  options?: AnalyticsSchedulingOptions,
): void {
  const metricList = Array.from(metrics).filter((metric) => metric.length > 0);

  if (metricList.length === 0) {
    return;
  }

  if (isUnitTestRuntime()) {
    scheduleAnalyticsBatch(metricList, options);
    return;
  }

  const pendingIncrement = createDeferredTelemetryTask(() =>
    incrementAnalyticsBatch(metricList, {
      endpoint: options?.endpoint,
      logContext: options?.logContext,
      now: options?.now,
      request: options?.request,
    }),
  );

  scheduleTelemetryTask(() => pendingIncrement, {
    endpoint: options?.endpoint,
    forceRequestContext: options?.forceRequestContext,
    request: options?.request,
    taskName: options?.taskName ?? "deferred analytics batch",
  });
}

function getPendingLowValueAnalyticsBatch(
  options?: AnalyticsSchedulingOptions,
): PendingLowValueAnalyticsBatch {
  const batchKey = options?.endpoint ?? "Analytics";
  const existingBatch = pendingLowValueAnalyticsBatches.get(batchKey);

  if (existingBatch) {
    if (!existingBatch.request && options?.request) {
      existingBatch.request = options.request;
    }

    if (!existingBatch.logContext && options?.logContext) {
      existingBatch.logContext = options.logContext;
    }

    if (!existingBatch.now && options?.now) {
      existingBatch.now = options.now;
    }

    return existingBatch;
  }

  const pendingBatch: PendingLowValueAnalyticsBatch = {
    endpoint: options?.endpoint ?? "Analytics",
    logContext: options?.logContext,
    metrics: new Map<string, number>(),
    now: options?.now,
    request: options?.request,
    scheduled: false,
  };
  pendingLowValueAnalyticsBatches.set(batchKey, pendingBatch);
  return pendingBatch;
}

function schedulePendingLowValueAnalyticsFlush(
  batch: PendingLowValueAnalyticsBatch,
  options?: AnalyticsSchedulingOptions,
): void {
  if (batch.scheduled) {
    return;
  }

  batch.scheduled = true;

  const flushBatch = async () => {
    const metricCounts = Array.from(batch.metrics.entries()).map(
      ([metric, count]) => ({ count, metric }),
    );

    batch.metrics.clear();
    batch.scheduled = false;

    if (metricCounts.length === 0) {
      return;
    }

    await incrementAnalyticsBatchCounts(metricCounts, {
      endpoint: batch.endpoint,
      logContext: batch.logContext,
      now: batch.now,
      request: batch.request,
    });
  };

  if (isUnitTestRuntime()) {
    scheduleTelemetryTask(flushBatch, {
      endpoint: batch.endpoint,
      forceRequestContext: options?.forceRequestContext,
      request: batch.request,
      taskName: options?.taskName ?? "low-value analytics batch",
    });
    return;
  }

  const pendingFlush = createDeferredTelemetryTask(flushBatch);
  scheduleTelemetryTask(() => pendingFlush, {
    endpoint: batch.endpoint,
    forceRequestContext: options?.forceRequestContext,
    request: batch.request,
    taskName: options?.taskName ?? "low-value analytics batch",
  });
}

export function scheduleLowValueAnalyticsBatch(
  metrics: Iterable<string>,
  options?: AnalyticsSchedulingOptions,
): void {
  const metricList = Array.from(metrics).filter((metric) => metric.length > 0);

  if (metricList.length === 0) {
    return;
  }

  const batch = getPendingLowValueAnalyticsBatch(options);

  for (const metric of metricList) {
    batch.metrics.set(metric, (batch.metrics.get(metric) ?? 0) + 1);
  }

  schedulePendingLowValueAnalyticsFlush(batch, options);
}

export function scheduleLowValueAnalyticsIncrement(
  metric: string,
  options?: AnalyticsSchedulingOptions,
): void {
  scheduleLowValueAnalyticsBatch([metric], options);
}
