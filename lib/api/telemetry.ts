import { redisClient } from "@/lib/api/clients";
import { logPrivacySafe } from "@/lib/api/logging";
import { trimOuterRepeatedCharacter } from "@/lib/utils";

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

const IS_TELEMETRY_TEST_PROCESS = (() => {
  const unitTestGlobals = globalThis as UnitTestTelemetryGlobals;

  return (
    unitTestGlobals.ANICARDS_UNIT_TEST === true ||
    unitTestGlobals.ANICARDS_UNIT_TEST_RUNTIME === true ||
    process.env[TELEMETRY_TEST_ENV_FLAG] === "true" ||
    process.env.NODE_ENV === "test"
  );
})();

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

export interface CronRefreshBatchTelemetrySnapshot {
  completedAt: string;
  batchSize: number;
  configuredBatchSize: number;
  dailyCapacity: number;
  estimatedSweepHours: number;
  failedUpdates: number;
  note: string;
  removedUsers: number;
  schedule: string;
  successfulUpdates: number;
  totalUsers: number;
  withinDailyBudget: boolean;
}

export interface TelemetryWriteHealthSnapshot {
  degraded: boolean;
  currentFailureStreak: number;
  pendingFailureCount: number;
  lastFailureAt?: string;
  lastFailureKind?: string;
  lastRecoveryAt?: string;
}

type TelemetryWriteFailureKind =
  | "analytics_increment"
  | "analytics_batch"
  | "analytics_batch_counts"
  | "cron_refresh_snapshot"
  | "write_health_sync";

type TelemetryWriteHealthState = TelemetryWriteHealthSnapshot & {
  dirty: boolean;
};

export type AnalyticsLatencyOutcome = "success" | "failure";

const ANALYTICS_REASON_CODE_FALLBACK = "unknown";
const ANALYTICS_REASON_CODE_MAX_LENGTH = 48;
const ANALYTICS_STATE_TTL_SECONDS = 14 * 24 * 60 * 60;
const ANALYTICS_LATENCY_BUCKETS = [
  { label: "lt_050ms", maxMs: 49 },
  { label: "050_099ms", maxMs: 99 },
  { label: "100_249ms", maxMs: 249 },
  { label: "250_499ms", maxMs: 499 },
  { label: "500_999ms", maxMs: 999 },
  { label: "1000_2499ms", maxMs: 2499 },
  { label: "2500_4999ms", maxMs: 4999 },
  { label: "gte_5000ms", maxMs: Number.POSITIVE_INFINITY },
] as const;

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
export const ANALYTICS_CRON_REFRESH_LAST_RUN_KEY =
  "analytics:cron_job:refresh_batch_last_run";
const TELEMETRY_WRITE_HEALTH_KEY = "analytics:telemetry:write_health";
const EXCLUDED_ANALYTICS_REPORT_STATE_KEYS = new Set<string>([
  ANALYTICS_CRON_REFRESH_LAST_RUN_KEY,
  TELEMETRY_WRITE_HEALTH_KEY,
]);
const pendingLowValueAnalyticsBatches = new Map<
  string,
  PendingLowValueAnalyticsBatch
>();

function createInitialTelemetryWriteHealthState(): TelemetryWriteHealthState {
  return {
    degraded: false,
    currentFailureStreak: 0,
    pendingFailureCount: 0,
    dirty: false,
  };
}

let telemetryWriteHealthState = createInitialTelemetryWriteHealthState();

export function isUnitTestRuntime(): boolean {
  const unitTestGlobals = globalThis as UnitTestTelemetryGlobals;
  if (typeof unitTestGlobals.ANICARDS_UNIT_TEST_RUNTIME === "boolean") {
    return unitTestGlobals.ANICARDS_UNIT_TEST_RUNTIME;
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

function trackTelemetryTaskIfNeeded(
  task: Promise<void>,
  shouldTrackPendingTaskForTests: boolean,
): void {
  if (shouldTrackPendingTaskForTests) {
    trackPendingTelemetryTaskForTests(task);
  }
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

function runTelemetryTask(
  task: () => Promise<void>,
  shouldTrackPendingTaskForTests: boolean,
): void {
  const pendingTask = task();
  trackTelemetryTaskIfNeeded(pendingTask, shouldTrackPendingTaskForTests);
}

function scheduleTelemetryTaskWithWaitUntil(
  waitUntil: RequestContextWaitUntil,
  task: () => Promise<void>,
  options: {
    endpoint: string;
    request?: Request;
    shouldTrackPendingTaskForTests: boolean;
    taskName: string;
  },
): void {
  let shouldRunDeferredTask = true;
  const pendingTask = createDeferredTelemetryTask(async () => {
    if (shouldRunDeferredTask) {
      await task();
    }
  });

  trackTelemetryTaskIfNeeded(
    pendingTask,
    options.shouldTrackPendingTaskForTests,
  );

  try {
    waitUntil(pendingTask);
  } catch (error) {
    shouldRunDeferredTask = false;
    logPrivacySafe(
      "warn",
      options.endpoint,
      "Falling back to immediate telemetry scheduling",
      {
        taskName: options.taskName,
        error: error instanceof Error ? error.message : String(error),
      },
      options.request,
    );

    runTelemetryTask(task, options.shouldTrackPendingTaskForTests);
  }
}

function buildAnalyticsLogContext(
  context: Record<string, unknown>,
  options?: AnalyticsIncrementOptions,
): Record<string, unknown> {
  return options?.logContext ? { ...options.logContext, ...context } : context;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseFiniteInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.trunc(value));
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : null;
  }

  return null;
}

function parseIsoTimestamp(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length === 0) {
    return undefined;
  }

  return Number.isNaN(Date.parse(value)) ? undefined : value;
}

function getTelemetryWriteHealthRecency(
  snapshot: TelemetryWriteHealthSnapshot,
): number {
  return Math.max(
    Date.parse(snapshot.lastFailureAt ?? "") || 0,
    Date.parse(snapshot.lastRecoveryAt ?? "") || 0,
  );
}

function hasTelemetryWriteHealthActivity(
  snapshot: TelemetryWriteHealthSnapshot,
): boolean {
  return (
    snapshot.degraded ||
    snapshot.currentFailureStreak > 0 ||
    snapshot.pendingFailureCount > 0 ||
    typeof snapshot.lastFailureAt === "string" ||
    typeof snapshot.lastRecoveryAt === "string"
  );
}

function buildTelemetryWriteHealthSnapshot(): TelemetryWriteHealthSnapshot {
  const {
    degraded,
    currentFailureStreak,
    pendingFailureCount,
    lastFailureAt,
    lastFailureKind,
    lastRecoveryAt,
  } = telemetryWriteHealthState;

  return {
    degraded,
    currentFailureStreak,
    pendingFailureCount,
    ...(lastFailureAt ? { lastFailureAt } : {}),
    ...(lastFailureKind ? { lastFailureKind } : {}),
    ...(lastRecoveryAt ? { lastRecoveryAt } : {}),
  };
}

function noteTelemetryWriteFailure(kind: TelemetryWriteFailureKind): void {
  const now = new Date().toISOString();

  telemetryWriteHealthState = {
    ...telemetryWriteHealthState,
    degraded: true,
    currentFailureStreak: telemetryWriteHealthState.currentFailureStreak + 1,
    pendingFailureCount: telemetryWriteHealthState.pendingFailureCount + 1,
    lastFailureAt: now,
    lastFailureKind: kind,
    dirty: true,
  };
}

function noteTelemetryWriteRecovery(): boolean {
  if (!hasTelemetryWriteHealthActivity(buildTelemetryWriteHealthSnapshot())) {
    return false;
  }

  telemetryWriteHealthState = {
    ...telemetryWriteHealthState,
    degraded: false,
    currentFailureStreak: 0,
    pendingFailureCount: 0,
    lastRecoveryAt: new Date().toISOString(),
    dirty: true,
  };

  return true;
}

async function persistAnalyticsStateValue(
  key: string,
  value: unknown,
  ttlSeconds = ANALYTICS_STATE_TTL_SECONDS,
): Promise<void> {
  await redisClient.set(key, JSON.stringify(value), {
    ex: ttlSeconds,
  });
  await redisClient.sadd(ANALYTICS_REPORTING_INDEX_KEY, key);
}

async function persistTelemetryWriteHealthSnapshot(): Promise<boolean> {
  try {
    await persistAnalyticsStateValue(
      TELEMETRY_WRITE_HEALTH_KEY,
      buildTelemetryWriteHealthSnapshot(),
    );
    telemetryWriteHealthState = {
      ...telemetryWriteHealthState,
      dirty: false,
    };
    return true;
  } catch {
    return false;
  }
}

async function syncTelemetryWriteHealthAfterSuccessfulWrite(
  options?: AnalyticsIncrementOptions,
): Promise<void> {
  const hadRecovery = noteTelemetryWriteRecovery();
  if (!hadRecovery && !telemetryWriteHealthState.dirty) {
    return;
  }

  const persisted = await persistTelemetryWriteHealthSnapshot();
  if (!persisted) {
    noteTelemetryWriteFailure("write_health_sync");
    logPrivacySafe(
      "warn",
      options?.endpoint ?? "Analytics",
      "Failed to persist telemetry write-health snapshot after recovery",
      buildAnalyticsLogContext(
        {
          stateKey: TELEMETRY_WRITE_HEALTH_KEY,
        },
        options,
      ),
      options?.request,
    );
  }
}

function parseTelemetryWriteHealthSnapshot(
  value: unknown,
): TelemetryWriteHealthSnapshot | null {
  let parsedValue = value;

  if (typeof parsedValue === "string") {
    try {
      parsedValue = JSON.parse(parsedValue) as unknown;
    } catch {
      return null;
    }
  }

  if (!isRecord(parsedValue) || typeof parsedValue.degraded !== "boolean") {
    return null;
  }

  const currentFailureStreak = parseFiniteInteger(
    parsedValue.currentFailureStreak,
  );
  const pendingFailureCount = parseFiniteInteger(
    parsedValue.pendingFailureCount,
  );

  if (currentFailureStreak === null || pendingFailureCount === null) {
    return null;
  }

  return {
    degraded: parsedValue.degraded,
    currentFailureStreak,
    pendingFailureCount,
    ...(parseIsoTimestamp(parsedValue.lastFailureAt)
      ? {
          lastFailureAt: parseIsoTimestamp(parsedValue.lastFailureAt),
        }
      : {}),
    ...(typeof parsedValue.lastFailureKind === "string" &&
    parsedValue.lastFailureKind.length > 0
      ? { lastFailureKind: parsedValue.lastFailureKind }
      : {}),
    ...(parseIsoTimestamp(parsedValue.lastRecoveryAt)
      ? {
          lastRecoveryAt: parseIsoTimestamp(parsedValue.lastRecoveryAt),
        }
      : {}),
  };
}

function parseCronRefreshBatchTelemetrySnapshot(
  value: unknown,
): CronRefreshBatchTelemetrySnapshot | null {
  let parsedValue = value;

  if (typeof parsedValue === "string") {
    try {
      parsedValue = JSON.parse(parsedValue) as unknown;
    } catch {
      return null;
    }
  }

  if (!isRecord(parsedValue)) {
    return null;
  }

  const batchSize = parseFiniteInteger(parsedValue.batchSize);
  const configuredBatchSize = parseFiniteInteger(
    parsedValue.configuredBatchSize,
  );
  const dailyCapacity = parseFiniteInteger(parsedValue.dailyCapacity);
  const estimatedSweepHours = parseFiniteInteger(
    parsedValue.estimatedSweepHours,
  );
  const failedUpdates = parseFiniteInteger(parsedValue.failedUpdates);
  const removedUsers = parseFiniteInteger(parsedValue.removedUsers);
  const successfulUpdates = parseFiniteInteger(parsedValue.successfulUpdates);
  const totalUsers = parseFiniteInteger(parsedValue.totalUsers);
  const completedAt = parseIsoTimestamp(parsedValue.completedAt);

  if (
    batchSize === null ||
    configuredBatchSize === null ||
    dailyCapacity === null ||
    estimatedSweepHours === null ||
    failedUpdates === null ||
    removedUsers === null ||
    successfulUpdates === null ||
    totalUsers === null ||
    completedAt === undefined ||
    typeof parsedValue.note !== "string" ||
    typeof parsedValue.schedule !== "string" ||
    typeof parsedValue.withinDailyBudget !== "boolean"
  ) {
    return null;
  }

  return {
    completedAt,
    batchSize,
    configuredBatchSize,
    dailyCapacity,
    estimatedSweepHours,
    failedUpdates,
    note: parsedValue.note,
    removedUsers,
    schedule: parsedValue.schedule,
    successfulUpdates,
    totalUsers,
    withinDailyBudget: parsedValue.withinDailyBudget,
  };
}

export function isExcludedAnalyticsReportStateKey(key: string): boolean {
  return EXCLUDED_ANALYTICS_REPORT_STATE_KEYS.has(key);
}

export async function readTelemetryWriteHealthSnapshot(): Promise<TelemetryWriteHealthSnapshot> {
  const inMemorySnapshot = buildTelemetryWriteHealthSnapshot();

  try {
    const storedSnapshot = parseTelemetryWriteHealthSnapshot(
      await redisClient.get(TELEMETRY_WRITE_HEALTH_KEY),
    );

    if (!storedSnapshot) {
      return inMemorySnapshot;
    }

    if (!hasTelemetryWriteHealthActivity(inMemorySnapshot)) {
      return storedSnapshot;
    }

    return getTelemetryWriteHealthRecency(inMemorySnapshot) >=
      getTelemetryWriteHealthRecency(storedSnapshot)
      ? inMemorySnapshot
      : storedSnapshot;
  } catch {
    return inMemorySnapshot;
  }
}

export async function readCronRefreshBatchTelemetrySnapshot(): Promise<CronRefreshBatchTelemetrySnapshot | null> {
  try {
    return parseCronRefreshBatchTelemetrySnapshot(
      await redisClient.get(ANALYTICS_CRON_REFRESH_LAST_RUN_KEY),
    );
  } catch {
    return null;
  }
}

export function scheduleCronRefreshBatchTelemetrySnapshot(
  snapshot: CronRefreshBatchTelemetrySnapshot,
  options?: AnalyticsSchedulingOptions,
): void {
  scheduleTelemetryTask(
    async () => {
      try {
        await persistAnalyticsStateValue(
          ANALYTICS_CRON_REFRESH_LAST_RUN_KEY,
          snapshot,
        );
        await syncTelemetryWriteHealthAfterSuccessfulWrite({
          endpoint: options?.endpoint,
          logContext: options?.logContext,
          now: options?.now,
          request: options?.request,
        });
      } catch (error) {
        noteTelemetryWriteFailure("cron_refresh_snapshot");
        logPrivacySafe(
          "warn",
          options?.endpoint ?? "Analytics",
          "Failed to persist cron refresh batch telemetry snapshot",
          buildAnalyticsLogContext(
            {
              stateKey: ANALYTICS_CRON_REFRESH_LAST_RUN_KEY,
              error: error instanceof Error ? error.message : String(error),
            },
            options,
          ),
          options?.request,
        );
      }
    },
    {
      endpoint: options?.endpoint,
      forceRequestContext: options?.forceRequestContext,
      request: options?.request,
      taskName: options?.taskName ?? "cron refresh batch telemetry snapshot",
    },
  );
}

export async function flushScheduledTelemetryTasksForTests(): Promise<void> {
  while (pendingTelemetryTasks.size > 0) {
    await Promise.allSettled(pendingTelemetryTasks);
  }

  pendingLowValueAnalyticsBatches.clear();
  telemetryWriteHealthState = createInitialTelemetryWriteHealthState();
}

export function scheduleTelemetryTask(
  task: () => Promise<unknown> | void,
  options?: TelemetryTaskSchedulingOptions,
): void {
  const taskName = options?.taskName ?? "scheduled telemetry task";
  const endpoint = options?.endpoint ?? "Telemetry";
  const forceRequestContext = options?.forceRequestContext ?? false;
  const isTrackedUnitTestRuntime = isUnitTestRuntime();
  const shouldTrackPendingTaskForTests = IS_TELEMETRY_TEST_PROCESS;

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
    runTelemetryTask(runTask, shouldTrackPendingTaskForTests);
    return;
  }

  const waitUntil = getRequestContextWaitUntil();
  if (waitUntil) {
    scheduleTelemetryTaskWithWaitUntil(waitUntil, runTask, {
      endpoint,
      request: options?.request,
      shouldTrackPendingTaskForTests,
      taskName,
    });
    return;
  }

  runTelemetryTask(runTask, shouldTrackPendingTaskForTests);
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

export function normalizeAnalyticsReasonCode(reasonCode: string): string {
  const normalized = trimOuterRepeatedCharacter(
    trimOuterRepeatedCharacter(
      reasonCode
        .trim()
        .toLowerCase()
        .replaceAll(/[^a-z0-9]+/g, "_"),
      "_",
    ).slice(0, ANALYTICS_REASON_CODE_MAX_LENGTH),
    "_",
  );

  return normalized.length > 0 ? normalized : ANALYTICS_REASON_CODE_FALLBACK;
}

export function buildReasonCodedMetricKey(
  endpointKey: string,
  metric: string,
  reasonCode: string,
): string {
  return buildAnalyticsMetricKey(
    endpointKey,
    metric,
    `reason:${normalizeAnalyticsReasonCode(reasonCode)}`,
  );
}

export function buildFailedRequestMetricKeys(
  endpointKey: string,
  reasonCode?: string,
): string[] {
  const failedMetric = buildAnalyticsMetricKey(endpointKey, "failed_requests");

  return reasonCode
    ? [
        failedMetric,
        buildReasonCodedMetricKey(endpointKey, "failed_requests", reasonCode),
      ]
    : [failedMetric];
}

export function getAnalyticsLatencyBucket(durationMs: number): string {
  const normalizedDurationMs = Number.isFinite(durationMs)
    ? Math.max(0, Math.trunc(durationMs))
    : 0;

  for (const bucket of ANALYTICS_LATENCY_BUCKETS) {
    if (normalizedDurationMs <= bucket.maxMs) {
      return bucket.label;
    }
  }

  return ANALYTICS_LATENCY_BUCKETS.at(-1)?.label ?? "gte_5000ms";
}

export function buildLatencyBucketMetricKeys(
  endpointKey: string,
  durationMs: number,
  outcome?: AnalyticsLatencyOutcome,
): string[] {
  const bucket = getAnalyticsLatencyBucket(durationMs);
  const metrics = [
    buildAnalyticsMetricKey(endpointKey, "latency_buckets", bucket),
  ];

  if (outcome) {
    metrics.push(
      buildAnalyticsMetricKey(
        endpointKey,
        "latency_buckets",
        `${outcome}:${bucket}`,
      ),
    );
  }

  return metrics;
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
    await syncTelemetryWriteHealthAfterSuccessfulWrite(options);
  } catch (error) {
    noteTelemetryWriteFailure("analytics_increment");
    logPrivacySafe(
      "warn",
      options?.endpoint ?? "Analytics",
      "Failed to increment analytics",
      buildAnalyticsLogContext(
        {
          metric,
          storageKey,
          error: error instanceof Error ? error.message : String(error),
        },
        options,
      ),
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
    await syncTelemetryWriteHealthAfterSuccessfulWrite(options);
  } catch (error) {
    noteTelemetryWriteFailure("analytics_batch");
    logPrivacySafe(
      "warn",
      options?.endpoint ?? "Analytics",
      "Failed to increment analytics batch",
      buildAnalyticsLogContext(
        {
          metricCount: metricList.length,
          metricPreview: metricList.slice(0, 3).join(","),
          error: error instanceof Error ? error.message : String(error),
        },
        options,
      ),
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
    await syncTelemetryWriteHealthAfterSuccessfulWrite(options);
  } catch (error) {
    noteTelemetryWriteFailure("analytics_batch_counts");
    logPrivacySafe(
      "warn",
      options?.endpoint ?? "Analytics",
      "Failed to increment analytics batch counts",
      buildAnalyticsLogContext(
        {
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
        options,
      ),
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

function syncPendingLowValueAnalyticsBatchContext(
  batch: PendingLowValueAnalyticsBatch,
  options?: AnalyticsSchedulingOptions,
): void {
  if (!batch.request && options?.request) {
    batch.request = options.request;
  }

  if (!batch.logContext && options?.logContext) {
    batch.logContext = options.logContext;
  }

  if (!batch.now && options?.now) {
    batch.now = options.now;
  }
}

function createPendingLowValueAnalyticsBatch(
  options?: AnalyticsSchedulingOptions,
): PendingLowValueAnalyticsBatch {
  return {
    endpoint: options?.endpoint ?? "Analytics",
    logContext: options?.logContext,
    metrics: new Map<string, number>(),
    now: options?.now,
    request: options?.request,
    scheduled: false,
  };
}

function getPendingLowValueAnalyticsBatch(
  options?: AnalyticsSchedulingOptions,
): PendingLowValueAnalyticsBatch {
  const batchKey = options?.endpoint ?? "Analytics";
  const existingBatch = pendingLowValueAnalyticsBatches.get(batchKey);

  if (existingBatch) {
    syncPendingLowValueAnalyticsBatchContext(existingBatch, options);
    return existingBatch;
  }

  const pendingBatch = createPendingLowValueAnalyticsBatch(options);
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
