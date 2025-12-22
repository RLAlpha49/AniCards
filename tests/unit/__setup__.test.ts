import { mock } from "bun:test";

// Silence console output
console.debug = mock(() => {});
console.log = mock(() => {});
console.info = mock(() => {});
console.warn = mock(() => {});
console.error = mock(() => {});

/**
 * Shared Redis mock client that will be used by all test files.
 * Each test file will reset these mocks in their setup functions.
 */
export const sharedRedisMockKeys = mock();
export const sharedRedisMockGet = mock();
export const sharedRedisMockSet = mock();
export const sharedRedisMockDel = mock();
export const sharedRedisMockIncr = mock(async () => 1);
export const sharedRedisMockRpush = mock();
export const sharedRedisMockLrange = mock();
export const sharedRedisMockMget = mock(
  async (...keys: string[]): Promise<(string | null)[]> => keys.map(() => null),
);
export const sharedRedisMockPipeline = mock();
export const sharedRedisMockPipelineSet = mock();
export const sharedRedisMockPipelineDel = mock();
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
  exec: sharedRedisMockPipelineExec,
};

const sharedRedisFakeClient = {
  keys: sharedRedisMockKeys,
  get: sharedRedisMockGet,
  set: sharedRedisMockSet,
  del: sharedRedisMockDel,
  incr: sharedRedisMockIncr,
  rpush: sharedRedisMockRpush,
  lrange: sharedRedisMockLrange,
  mget: sharedRedisMockMget,
  pipeline: mock(() => sharedRedisPipelineMock),
};

// Register the shared Redis mock FIRST
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
});
export const sharedRatelimitMockSlidingWindow = mock(() => "fake-limiter");

const RatelimitMockClass = mock().mockImplementation(() => ({
  limit: sharedRatelimitMockLimit,
}));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(RatelimitMockClass as any).slidingWindow = sharedRatelimitMockSlidingWindow;

// Register the shared Ratelimit mock
mock.module("@upstash/ratelimit", () => ({
  Ratelimit: RatelimitMockClass,
}));
