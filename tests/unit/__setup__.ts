/**
 * Shared Bun test bootstrap for unit API routes.
 * Centralizing shared console defaults and Upstash doubles keeps each spec
 * focused on handler behavior instead of repeating the same client scaffolding.
 */

import { inspect } from "node:util";

import { afterEach, beforeEach, mock } from "bun:test";

console.debug = mock(() => {});
console.log = mock(() => {});
console.info = mock(() => {});

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

console.warn = unexpectedConsoleWarn as typeof console.warn;
console.error = unexpectedConsoleError as typeof console.error;

beforeEach(() => {
  unexpectedConsoleWarn.mockClear();
  unexpectedConsoleError.mockClear();
  console.warn = unexpectedConsoleWarn as typeof console.warn;
  console.error = unexpectedConsoleError as typeof console.error;
});

afterEach(() => {
  console.warn = unexpectedConsoleWarn as typeof console.warn;
  console.error = unexpectedConsoleError as typeof console.error;
});

export function allowConsoleWarningsAndErrors() {
  const consoleWarn = mock(() => {});
  const consoleError = mock(() => {});

  console.warn = consoleWarn as typeof console.warn;
  console.error = consoleError as typeof console.error;

  return {
    consoleWarn,
    consoleError,
  };
}

/**
 * Shared Redis mock client that will be used by all test files.
 * Each test file will reset these mocks in their setup functions.
 */
export const sharedRedisMockScan = mock();
export const sharedRedisMockGet = mock();
export const sharedRedisMockSet = mock();
export const sharedRedisMockDel = mock();
export const sharedRedisMockIncr = mock(async (...args: unknown[]) => {
  void args;
  return 1;
});
export const sharedRedisMockIncrRaw = mock(async (...args: unknown[]) => {
  void args;
  return 1;
});
export const sharedRedisMockExpire = mock(async (...args: unknown[]) => {
  void args;
  return 1;
});
export const sharedRedisMockRpush = mock();
export const sharedRedisMockLrange = mock();
export const sharedRedisMockLtrim = mock();
export const sharedRedisMockMget = mock(
  async (...keys: string[]): Promise<(string | null)[]> => keys.map(() => null),
);
export const sharedRedisMockPipeline = mock();
export const sharedRedisMockPipelineSet = mock();
export const sharedRedisMockPipelineDel = mock();
export const sharedRedisMockPipelineZadd = mock();
export const sharedRedisMockZadd = mock(async () => 1);
export const sharedRedisMockZrange = mock(async () => [] as string[]);
export const sharedRedisMockZcard = mock(async () => 0);
export const sharedRedisMockZrem = mock(async () => 1);
export const sharedRedisMockPipelineExec = mock(async () => []);

function normalizeAnalyticsCounterKeyForAssertions(key: unknown): unknown {
  if (typeof key !== "string") return key;
  return key.replace(/:month:\d{4}-\d{2}$/, "");
}

const sharedRedisPipelineMock = {
  set: mock((...args: unknown[]) => {
    sharedRedisMockPipelineSet(...args);
    sharedRedisMockSet(...args);
    return sharedRedisPipelineMock;
  }),
  del: mock((...args: unknown[]) => {
    sharedRedisMockPipelineDel(...args);
    sharedRedisMockDel(...args);
    return sharedRedisPipelineMock;
  }),
  zadd: mock((...args: unknown[]) => {
    sharedRedisMockPipelineZadd(...args);
    const invokeSharedRedisMockZadd = sharedRedisMockZadd as unknown as (
      ...callArgs: unknown[]
    ) => unknown;
    invokeSharedRedisMockZadd(...args);
    return sharedRedisPipelineMock;
  }),
  exec: sharedRedisMockPipelineExec,
};

const sharedRedisFakeClient = {
  scan: sharedRedisMockScan,
  get: sharedRedisMockGet,
  set: sharedRedisMockSet,
  del: sharedRedisMockDel,
  incr: mock(async (key: unknown) => {
    const invokeSharedRedisMockIncrRaw = sharedRedisMockIncrRaw as unknown as (
      ...callArgs: unknown[]
    ) => Promise<unknown>;
    const invokeSharedRedisMockIncr = sharedRedisMockIncr as unknown as (
      ...callArgs: unknown[]
    ) => Promise<unknown>;

    await invokeSharedRedisMockIncrRaw(key);
    return invokeSharedRedisMockIncr(
      normalizeAnalyticsCounterKeyForAssertions(key),
    );
  }),
  expire: sharedRedisMockExpire,
  rpush: sharedRedisMockRpush,
  lrange: sharedRedisMockLrange,
  ltrim: sharedRedisMockLtrim,
  mget: sharedRedisMockMget,
  zadd: sharedRedisMockZadd,
  zrange: sharedRedisMockZrange,
  zcard: sharedRedisMockZcard,
  zrem: sharedRedisMockZrem,
  pipeline: mock(() => sharedRedisPipelineMock),
};

mock.module("@upstash/redis", () => ({
  Redis: {
    fromEnv: mock(() => sharedRedisFakeClient),
  },
}));

/**
 * Shared Ratelimit mock that will be used by all test files.
 */
export const sharedRatelimitMockLimit = mock().mockResolvedValue({
  success: true,
  limit: 10,
  remaining: 9,
  reset: Date.now() + 10_000,
  pending: Promise.resolve(),
});
export const sharedRatelimitMockSlidingWindow = mock(() => "fake-limiter");

const RatelimitMockClass = mock().mockImplementation(() => ({
  limit: sharedRatelimitMockLimit,
}));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(RatelimitMockClass as any).slidingWindow = sharedRatelimitMockSlidingWindow;

mock.module("@upstash/ratelimit", () => ({
  Ratelimit: RatelimitMockClass,
}));
