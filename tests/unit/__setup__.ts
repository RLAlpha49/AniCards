/**
 * Shared Bun test bootstrap for unit API routes.
 * Centralizing console silencing and Upstash doubles keeps each spec focused on
 * handler behavior instead of repeating the same client scaffolding.
 */

import { mock } from "bun:test";

console.debug = mock(() => {});
console.log = mock(() => {});
console.info = mock(() => {});
console.warn = mock(() => {});
console.error = mock(() => {});

/**
 * Shared Redis mock client that will be used by all test files.
 * Each test file will reset these mocks in their setup functions.
 */
export const sharedRedisMockScan = mock();
export const sharedRedisMockGet = mock();
export const sharedRedisMockSet = mock();
export const sharedRedisMockDel = mock();
export const sharedRedisMockIncr = mock(async () => 1);
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
  incr: sharedRedisMockIncr,
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
