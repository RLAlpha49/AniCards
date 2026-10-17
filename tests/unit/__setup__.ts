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
export const sharedRedisMockScan = mock();
export const sharedRedisMockGet = mock();
export const sharedRedisMockSet = mock();
export const sharedRedisMockDel = mock();
export const sharedRedisMockIncr = mock(() => Promise.resolve(1));
export const sharedRedisMockRpush = mock();
export const sharedRedisMockLrange = mock(() => Promise.resolve([]));
/**
 * Shared MGET mock.
 *
 * The return type mirrors what `@upstash/redis` actually hands back: it parses
 * stored JSON, so a value written as `"1"` arrives as the number 1 rather than
 * a string. Typing it as string-only let a real `Buffer.byteLength` failure
 * pass CI, so the wider type is deliberate.
 */
export const sharedRedisMockMget = mock(
  (...keys: string[]): Promise<(string | number | null)[]> =>
    Promise.resolve(keys.map(() => null)),
);
export const sharedRedisMockZadd = mock((..._args: unknown[]) =>
  Promise.resolve(0),
);
export const sharedRedisMockZrange = mock(
  (..._args: unknown[]): Promise<(string | number)[]> => Promise.resolve([]),
);
export const sharedRedisMockZcard = mock((..._args: unknown[]) =>
  Promise.resolve(0),
);
export const sharedRedisMockZrem = mock((..._args: unknown[]) =>
  Promise.resolve(0),
);
export const sharedRedisMockEval = mock(
  async (_script: string, keys: string[], args: string[]) => {
    const key = keys[0];

    if (args.length === 0) {
      const storedValue = await sharedRedisMockGet(key);
      return storedValue == null
        ? "__MISSING_CARDS_VALUE__"
        : `__CARDS_VALUE__:${storedValue}`;
    }

    await sharedRedisMockSet(key, args[2]);
    return 1;
  },
);
export const sharedRedisMockHincrby = mock((..._args: unknown[]) =>
  Promise.resolve(1),
);
export const sharedRedisMockZincrby = mock((..._args: unknown[]) =>
  Promise.resolve(1),
);
export const sharedRedisMockExpire = mock((..._args: unknown[]) =>
  Promise.resolve(1),
);
export const sharedRedisMockPipeline = mock();
export const sharedRedisMockPipelineSet = mock();
export const sharedRedisMockPipelineDel = mock();
export const sharedRedisMockPipelineHincrby = mock();
export const sharedRedisMockPipelineZincrby = mock();
export const sharedRedisMockPipelineExpire = mock();
export const sharedRedisMockPipelineExec = mock(() => Promise.resolve([]));

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
  hincrby: mock((...args: unknown[]) => {
    sharedRedisMockPipelineHincrby(...args);
    sharedRedisMockHincrby(...args);
    return sharedRedisPipelineMock;
  }),
  zincrby: mock((...args: unknown[]) => {
    sharedRedisMockPipelineZincrby(...args);
    return sharedRedisPipelineMock;
  }),
  expire: mock((...args: unknown[]) => {
    sharedRedisMockPipelineExpire(...args);
    sharedRedisMockExpire(...args);
    return sharedRedisPipelineMock;
  }),
  zadd: mock((...args: unknown[]) => {
    sharedRedisMockZadd(...args);
    return sharedRedisPipelineMock;
  }),
  zrem: mock((...args: unknown[]) => {
    sharedRedisMockZrem(...args);
    return sharedRedisPipelineMock;
  }),
  exec: sharedRedisMockPipelineExec,
};

const sharedRedisFakeClient = {
  scan: sharedRedisMockScan,
  get: sharedRedisMockGet,
  set: sharedRedisMockSet,
  del: sharedRedisMockDel,
  eval: sharedRedisMockEval,
  incr: sharedRedisMockIncr,
  hincrby: sharedRedisMockHincrby,
  zincrby: sharedRedisMockZincrby,
  expire: sharedRedisMockExpire,
  rpush: sharedRedisMockRpush,
  lrange: sharedRedisMockLrange,
  mget: sharedRedisMockMget,
  zadd: sharedRedisMockZadd,
  zrange: sharedRedisMockZrange,
  zcard: sharedRedisMockZcard,
  zrem: sharedRedisMockZrem,
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
