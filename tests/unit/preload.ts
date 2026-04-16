import { inspect } from "node:util";

import { afterEach, beforeEach, mock } from "bun:test";

declare global {
  var ANICARDS_UNIT_TEST: boolean | undefined;
  var ANICARDS_UNIT_TEST_RUNTIME: boolean | undefined;
}

const TEST_ENV_KEYS_TO_CLEAR_BEFORE_EACH = [
  "ALLOW_UNSECURED_CRON_IN_DEV",
  "ANILIST_TOKEN",
  "ANILIST_UPSTREAM_CIRCUIT_COOLDOWN_MS",
  "ANILIST_UPSTREAM_CIRCUIT_FAILURE_THRESHOLD",
  "ANILIST_UPSTREAM_DEGRADED_MODE",
  "API_SECRET_TOKEN",
  "CRON_SECRET",
  "ERROR_ALERT_WEBHOOK_URL",
  "TRUSTED_CLIENT_IP_HEADERS",
  "UPSTASH_REDIS_LATENCY_LOGGING",
] as const;

function setUnitTestFlags(): void {
  process.env.ANICARDS_UNIT_TEST = "true";
  globalThis.ANICARDS_UNIT_TEST = true;
  globalThis.ANICARDS_UNIT_TEST_RUNTIME = true;
}

const formatConsoleArgs = (args: unknown[]): string =>
  args
    .map((arg) => {
      if (arg instanceof Error) {
        return [arg.name + ": " + arg.message, arg.stack]
          .filter(Boolean)
          .join("\n");
      }

      return typeof arg === "string"
        ? arg
        : inspect(arg, {
            breakLength: 120,
            depth: 5,
          });
    })
    .join(" ");

const unexpectedConsoleWarn = mock((...args: unknown[]) => {
  throw new Error(
    [
      "Unexpected console.warn output during a unit test.",
      "Add a suite-local mock or assertion when the warning is intentional.",
      formatConsoleArgs(args),
    ]
      .filter(Boolean)
      .join("\n\n"),
  );
});

const unexpectedConsoleError = mock((...args: unknown[]) => {
  throw new Error(
    [
      "Unexpected console.error output during a unit test.",
      "Add a suite-local mock or assertion when the error is intentional.",
      formatConsoleArgs(args),
    ]
      .filter(Boolean)
      .join("\n\n"),
  );
});

function applyUnexpectedConsoleSafety(): void {
  console.warn = unexpectedConsoleWarn as typeof console.warn;
  console.error = unexpectedConsoleError as typeof console.error;
}

type SharedRedisEvalImplementation = (
  script: unknown,
  keys: unknown,
  args: unknown,
) => Promise<unknown>;

async function invokeDefaultRedisEval(
  ...args: Parameters<SharedRedisEvalImplementation>
): Promise<unknown> {
  const { defaultRedisEval } = await import("./__setup__");

  return defaultRedisEval(...args);
}

function resetSharedRedisEvalHarness(): void {
  sharedRedisMockEval.mockReset();
  sharedRedisMockEval.mockImplementation(invokeDefaultRedisEval);
}

console.debug = mock(() => {});
console.log = mock(() => {});
console.info = mock(() => {});
setUnitTestFlags();
applyUnexpectedConsoleSafety();

export const sharedRedisMockScan = mock();
export const sharedRedisMockGet = mock();
export const sharedRedisMockSet = mock();
export const sharedRedisMockEval = mock(invokeDefaultRedisEval);
export const sharedRedisMockDel = mock();
export const sharedRedisMockIncr = mock();
export const sharedRedisMockIncrRaw = mock();
export const sharedRedisMockExpire = mock();
export const sharedRedisMockRpush = mock();
export const sharedRedisMockLrange = mock();
export const sharedRedisMockLtrim = mock();
export const sharedRedisMockMget = mock();
export const sharedRedisMockSadd = mock();
export const sharedRedisMockSmembers = mock();
export const sharedRedisMockSrem = mock();
export const sharedRedisMockPipeline = mock();
export const sharedRedisMockPipelineSet = mock();
export const sharedRedisMockPipelineDel = mock();
export const sharedRedisMockPipelineSadd = mock();
export const sharedRedisMockPipelineZadd = mock();
export const sharedRedisMockPipelineIncr = mock();
export const sharedRedisMockPipelineExpire = mock();
export const sharedRedisMockZadd = mock();
export const sharedRedisMockZrange = mock();
export const sharedRedisMockZcard = mock();
export const sharedRedisMockZrem = mock();
export const sharedRedisMockPipelineExec = mock();

export const sharedRatelimitMockLimit = mock();
export const sharedRatelimitMockSlidingWindow = mock();

const sharedRedisRpushObservers = new Set<(args: unknown[]) => void>();
const sharedRedisLtrimObservers = new Set<(args: unknown[]) => void>();
const sharedRedisIncrObservers = new Set<(args: unknown[]) => void>();

function notifySharedRedisCallObservers(
  observers: Set<(args: unknown[]) => void>,
  args: unknown[],
): void {
  for (const observer of observers) {
    observer([...args]);
  }
}

function captureSharedRedisCalls(observers: Set<(args: unknown[]) => void>): {
  readonly calls: unknown[][];
  release: () => void;
} {
  const calls: unknown[][] = [];
  const observer = (args: unknown[]) => {
    calls.push(args);
  };

  observers.add(observer);

  return {
    get calls() {
      return calls.map((args) => [...args]);
    },
    release: () => {
      observers.delete(observer);
    },
  };
}

export function captureSharedRedisRpushCalls(): {
  calls: unknown[][];
  release: () => void;
} {
  return captureSharedRedisCalls(sharedRedisRpushObservers);
}

export function captureSharedRedisLtrimCalls(): {
  calls: unknown[][];
  release: () => void;
} {
  return captureSharedRedisCalls(sharedRedisLtrimObservers);
}

export function captureSharedRedisIncrCalls(): {
  calls: unknown[][];
  release: () => void;
} {
  return captureSharedRedisCalls(sharedRedisIncrObservers);
}

function normalizeAnalyticsCounterKeyForAssertions(key: unknown): unknown {
  if (typeof key !== "string") {
    return key;
  }

  return key.replace(/:month:\d{4}-\d{2}$/, "");
}

function detachPromise(result: unknown): void {
  if (result instanceof Promise) {
    result.catch(() => undefined);
  }
}

const sharedRedisPipelineMock = {
  set: (...args: unknown[]) => {
    sharedRedisMockPipelineSet(...args);
    sharedRedisMockSet(...args);
    return sharedRedisPipelineMock;
  },
  del: (...args: unknown[]) => {
    sharedRedisMockPipelineDel(...args);
    sharedRedisMockDel(...args);
    return sharedRedisPipelineMock;
  },
  sadd: (...args: unknown[]) => {
    sharedRedisMockPipelineSadd(...args);
    const saddResult = (
      sharedRedisMockSadd as unknown as (...callArgs: unknown[]) => unknown
    )(...args);
    detachPromise(saddResult);
    return sharedRedisPipelineMock;
  },
  zadd: (...args: unknown[]) => {
    sharedRedisMockPipelineZadd(...args);
    const zaddResult = (
      sharedRedisMockZadd as unknown as (...callArgs: unknown[]) => unknown
    )(...args);
    detachPromise(zaddResult);
    return sharedRedisPipelineMock;
  },
  incr: (key: unknown) => {
    sharedRedisMockPipelineIncr(key);
    const normalizedKey = normalizeAnalyticsCounterKeyForAssertions(key);

    notifySharedRedisCallObservers(sharedRedisIncrObservers, [normalizedKey]);

    const incrRawResult = (
      sharedRedisMockIncrRaw as unknown as (...callArgs: unknown[]) => unknown
    )(key);
    const incrResult = (
      sharedRedisMockIncr as unknown as (...callArgs: unknown[]) => unknown
    )(normalizedKey);

    detachPromise(incrRawResult);
    detachPromise(incrResult);
    return sharedRedisPipelineMock;
  },
  expire: (...args: unknown[]) => {
    sharedRedisMockPipelineExpire(...args);
    const expireResult = (
      sharedRedisMockExpire as unknown as (...callArgs: unknown[]) => unknown
    )(...args);
    detachPromise(expireResult);
    return sharedRedisPipelineMock;
  },
  exec: (...args: unknown[]) =>
    (
      sharedRedisMockPipelineExec as unknown as (
        ...callArgs: unknown[]
      ) => unknown
    )(...args),
};

const sharedRedisFakeClient = {
  scan: (...args: unknown[]) =>
    (sharedRedisMockScan as unknown as (...callArgs: unknown[]) => unknown)(
      ...args,
    ),
  get: (...args: unknown[]) =>
    (sharedRedisMockGet as unknown as (...callArgs: unknown[]) => unknown)(
      ...args,
    ),
  set: (...args: unknown[]) =>
    (sharedRedisMockSet as unknown as (...callArgs: unknown[]) => unknown)(
      ...args,
    ),
  eval: (...args: unknown[]) =>
    (sharedRedisMockEval as unknown as (...callArgs: unknown[]) => unknown)(
      ...args,
    ),
  del: (...args: unknown[]) =>
    (sharedRedisMockDel as unknown as (...callArgs: unknown[]) => unknown)(
      ...args,
    ),
  incr: async (key: unknown) => {
    const normalizedKey = normalizeAnalyticsCounterKeyForAssertions(key);

    notifySharedRedisCallObservers(sharedRedisIncrObservers, [normalizedKey]);

    await (
      sharedRedisMockIncrRaw as unknown as (
        ...callArgs: unknown[]
      ) => Promise<unknown>
    )(key);

    return (
      sharedRedisMockIncr as unknown as (
        ...callArgs: unknown[]
      ) => Promise<unknown>
    )(normalizedKey);
  },
  expire: (...args: unknown[]) =>
    (sharedRedisMockExpire as unknown as (...callArgs: unknown[]) => unknown)(
      ...args,
    ),
  rpush: (...args: unknown[]) => {
    notifySharedRedisCallObservers(sharedRedisRpushObservers, args);

    const result = (
      sharedRedisMockRpush as unknown as (...callArgs: unknown[]) => unknown
    )(...args);

    return result === undefined ? 1 : result;
  },
  lrange: (...args: unknown[]) =>
    (sharedRedisMockLrange as unknown as (...callArgs: unknown[]) => unknown)(
      ...args,
    ),
  ltrim: (...args: unknown[]) => {
    notifySharedRedisCallObservers(sharedRedisLtrimObservers, args);

    const result = (
      sharedRedisMockLtrim as unknown as (...callArgs: unknown[]) => unknown
    )(...args);

    return result === undefined ? "OK" : result;
  },
  mget: (...args: unknown[]) =>
    (sharedRedisMockMget as unknown as (...callArgs: unknown[]) => unknown)(
      ...args,
    ),
  sadd: (...args: unknown[]) =>
    (sharedRedisMockSadd as unknown as (...callArgs: unknown[]) => unknown)(
      ...args,
    ),
  smembers: (...args: unknown[]) =>
    (sharedRedisMockSmembers as unknown as (...callArgs: unknown[]) => unknown)(
      ...args,
    ),
  srem: (...args: unknown[]) =>
    (sharedRedisMockSrem as unknown as (...callArgs: unknown[]) => unknown)(
      ...args,
    ),
  zadd: (...args: unknown[]) =>
    (sharedRedisMockZadd as unknown as (...callArgs: unknown[]) => unknown)(
      ...args,
    ),
  zrange: (...args: unknown[]) =>
    (sharedRedisMockZrange as unknown as (...callArgs: unknown[]) => unknown)(
      ...args,
    ),
  zcard: (...args: unknown[]) =>
    (sharedRedisMockZcard as unknown as (...callArgs: unknown[]) => unknown)(
      ...args,
    ),
  zrem: (...args: unknown[]) =>
    (sharedRedisMockZrem as unknown as (...callArgs: unknown[]) => unknown)(
      ...args,
    ),
  pipeline: () => {
    sharedRedisMockPipeline();
    return sharedRedisPipelineMock;
  },
};

export const sharedRedisFromEnvMock = mock((options?: unknown) => {
  void options;
  return sharedRedisFakeClient;
});

const delegatingRatelimitLimit = (...args: unknown[]) =>
  (sharedRatelimitMockLimit as unknown as (...callArgs: unknown[]) => unknown)(
    ...args,
  );
const delegatingRatelimitSlidingWindow = (...args: unknown[]) =>
  (
    sharedRatelimitMockSlidingWindow as unknown as (
      ...callArgs: unknown[]
    ) => unknown
  )(...args);
const RatelimitMockClass = mock().mockImplementation(() => ({
  limit: delegatingRatelimitLimit,
}));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(RatelimitMockClass as any).slidingWindow = delegatingRatelimitSlidingWindow;

mock.module("@upstash/redis", () => ({
  Redis: {
    fromEnv: (options: unknown) => sharedRedisFromEnvMock(options),
  },
}));

mock.module("@upstash/ratelimit", () => ({
  Ratelimit: RatelimitMockClass,
}));

function buildDefaultRatelimitResult() {
  return {
    success: true,
    limit: 10,
    remaining: 9,
    reset: Date.now() + 10_000,
    pending: Promise.resolve(),
  };
}

export function resetSharedUpstashHarness(): void {
  unexpectedConsoleWarn.mockClear();
  unexpectedConsoleError.mockClear();
  sharedRedisRpushObservers.clear();
  sharedRedisLtrimObservers.clear();
  sharedRedisIncrObservers.clear();

  sharedRedisMockScan.mockReset();
  sharedRedisMockScan.mockResolvedValue([0, []]);
  sharedRedisMockGet.mockReset();
  sharedRedisMockGet.mockResolvedValue(null);
  sharedRedisMockSet.mockReset();
  sharedRedisMockSet.mockResolvedValue(true);
  resetSharedRedisEvalHarness();
  sharedRedisMockDel.mockReset();
  sharedRedisMockDel.mockResolvedValue(1);
  sharedRedisMockIncr.mockReset();
  sharedRedisMockIncr.mockResolvedValue(1);
  sharedRedisMockIncrRaw.mockReset();
  sharedRedisMockIncrRaw.mockResolvedValue(1);
  sharedRedisMockExpire.mockReset();
  sharedRedisMockExpire.mockResolvedValue(1);
  sharedRedisMockRpush.mockReset();
  sharedRedisMockRpush.mockResolvedValue(1);
  sharedRedisMockLrange.mockReset();
  sharedRedisMockLrange.mockResolvedValue([]);
  sharedRedisMockLtrim.mockReset();
  sharedRedisMockLtrim.mockResolvedValue("OK");
  sharedRedisMockMget.mockReset();
  sharedRedisMockMget.mockImplementation(async (...keys: string[]) =>
    keys.map(() => null),
  );
  sharedRedisMockSadd.mockReset();
  sharedRedisMockSadd.mockResolvedValue(1);
  sharedRedisMockSmembers.mockReset();
  sharedRedisMockSmembers.mockResolvedValue([] as string[]);
  sharedRedisMockSrem.mockReset();
  sharedRedisMockSrem.mockResolvedValue(1);
  sharedRedisMockPipeline.mockReset();
  sharedRedisMockPipelineSet.mockReset();
  sharedRedisMockPipelineDel.mockReset();
  sharedRedisMockPipelineSadd.mockReset();
  sharedRedisMockPipelineZadd.mockReset();
  sharedRedisMockPipelineIncr.mockReset();
  sharedRedisMockPipelineExpire.mockReset();
  sharedRedisMockPipelineExec.mockReset();
  sharedRedisMockPipelineExec.mockResolvedValue([]);
  sharedRedisMockZadd.mockReset();
  sharedRedisMockZadd.mockResolvedValue(1);
  sharedRedisMockZrange.mockReset();
  sharedRedisMockZrange.mockResolvedValue([] as string[]);
  sharedRedisMockZcard.mockReset();
  sharedRedisMockZcard.mockResolvedValue(0);
  sharedRedisMockZrem.mockReset();
  sharedRedisMockZrem.mockResolvedValue(1);

  sharedRedisFromEnvMock.mockReset();
  sharedRedisFromEnvMock.mockImplementation(() => sharedRedisFakeClient);

  sharedRatelimitMockLimit.mockReset();
  sharedRatelimitMockLimit.mockResolvedValue(buildDefaultRatelimitResult());
  sharedRatelimitMockSlidingWindow.mockReset();
  sharedRatelimitMockSlidingWindow.mockImplementation(() => "fake-limiter");
  RatelimitMockClass.mockReset();
  RatelimitMockClass.mockImplementation(() => ({
    limit: delegatingRatelimitLimit,
  }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (RatelimitMockClass as any).slidingWindow = delegatingRatelimitSlidingWindow;
}

resetSharedUpstashHarness();

beforeEach(() => {
  unexpectedConsoleWarn.mockClear();
  unexpectedConsoleError.mockClear();
  sharedRedisRpushObservers.clear();
  sharedRedisLtrimObservers.clear();
  sharedRedisIncrObservers.clear();
  applyUnexpectedConsoleSafety();
  setUnitTestFlags();
  (process.env as Record<string, string | undefined>).NODE_ENV = "test";

  for (const key of TEST_ENV_KEYS_TO_CLEAR_BEFORE_EACH) {
    delete process.env[key];
  }

  resetSharedRedisEvalHarness();
});

afterEach(() => {
  applyUnexpectedConsoleSafety();
});
