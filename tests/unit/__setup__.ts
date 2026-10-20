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
export const sharedRedisMockIncr = mock((..._args: unknown[]) =>
  Promise.resolve(1),
);
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
export const sharedRedisMockTtl = mock((..._args: unknown[]) =>
  Promise.resolve(-1),
);
export const sharedRedisMockPipeline = mock();
export const sharedRedisMockPipelineSet = mock();
export const sharedRedisMockPipelineDel = mock();
export const sharedRedisMockPipelineHincrby = mock();
export const sharedRedisMockPipelineZincrby = mock();
export const sharedRedisMockPipelineIncr = mock();
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
  // Analytics counters are queued onto a pipeline, so forwarding here keeps
  // assertions on `sharedRedisMockIncr` meaningful for both call paths.
  incr: mock((...args: unknown[]) => {
    sharedRedisMockPipelineIncr(...args);
    sharedRedisMockIncr(...args);
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

/**
 * Mock for reads of the shared SVG cache tier.
 *
 * The card route asks this tier before it renders. Sharing `sharedRedisMockGet`
 * would consume the first value each test queues for the `cards:<id>` read and
 * shift every later read by one. Keys with the `svg_cache:` prefix are routed
 * here instead, so a test that does not care about the shared tier sees a miss
 * and the queues it sets up keep their original meaning.
 */
export const sharedRedisMockSvgCacheGet = mock(
  (..._args: unknown[]): Promise<unknown> => Promise.resolve(null),
);
export const sharedRedisMockSvgCacheSet = mock(
  (..._args: unknown[]): Promise<unknown> => Promise.resolve("OK"),
);
export const sharedRedisMockSvgCacheDel = mock(
  (..._args: unknown[]): Promise<unknown> => Promise.resolve(1),
);

const SVG_CACHE_KEY_PREFIX = "svg_cache:";

const isSvgCacheKey = (key: unknown): boolean =>
  typeof key === "string" && key.startsWith(SVG_CACHE_KEY_PREFIX);

const routingRedisGet = mock((...args: unknown[]) => {
  if (isSvgCacheKey(args[0])) return sharedRedisMockSvgCacheGet(...args);
  return sharedRedisMockGet(...args);
});

const routingRedisSet = mock((...args: unknown[]) => {
  if (isSvgCacheKey(args[0])) return sharedRedisMockSvgCacheSet(...args);
  return sharedRedisMockSet(...args);
});

const routingRedisDel = mock((...args: unknown[]) => {
  if (args.length > 0 && args.every(isSvgCacheKey)) {
    return sharedRedisMockSvgCacheDel(...args);
  }
  return sharedRedisMockDel(...args);
});

const sharedRedisFakeClient = {
  scan: sharedRedisMockScan,
  get: routingRedisGet,
  set: routingRedisSet,
  del: routingRedisDel,
  eval: sharedRedisMockEval,
  incr: sharedRedisMockIncr,
  hincrby: sharedRedisMockHincrby,
  zincrby: sharedRedisMockZincrby,
  expire: sharedRedisMockExpire,
  ttl: sharedRedisMockTtl,
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

/**
 * Shared QStash mocks. `publishJSON` records every published message so tests
 * can assert on the url, body, headers, and flow control of each one.
 */
export const sharedQstashPublishJSON = mock(
  (..._args: unknown[]): Promise<{ messageId: string }> =>
    Promise.resolve({
      messageId: `msg_${sharedQstashPublishJSON.mock.calls.length}`,
    }),
);
export const sharedQstashSchedulesCreate = mock(
  (options?: { scheduleId?: string }): Promise<{ scheduleId: string }> =>
    Promise.resolve({ scheduleId: options?.scheduleId ?? "scd_test" }),
);
export const sharedQstashSchedulesList = mock(
  (..._args: unknown[]): Promise<unknown[]> => Promise.resolve([]),
);
export const sharedQstashSchedulesDelete = mock(
  (..._args: unknown[]): Promise<void> => Promise.resolve(),
);

const QStashClientMock = mock().mockImplementation(() => ({
  publishJSON: sharedQstashPublishJSON,
  schedules: {
    create: sharedQstashSchedulesCreate,
    list: sharedQstashSchedulesList,
    delete: sharedQstashSchedulesDelete,
  },
}));

mock.module("@upstash/qstash", () => ({
  Client: QStashClientMock,
}));
