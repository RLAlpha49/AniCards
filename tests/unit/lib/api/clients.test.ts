import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

import { sharedRedisFromEnvMock } from "../../__setup__";

type RedisFromEnvOptions = {
  enableAutoPipelining: boolean;
  retry: {
    retries: number;
    backoff: (retryCount: number) => number;
  };
  latencyLogging: boolean;
};

async function importClientsModule() {
  const moduleUrl = new URL("../../../../lib/api/clients.ts", import.meta.url);
  moduleUrl.searchParams.set(
    "cacheBust",
    `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );

  return (await import(moduleUrl.href)) as typeof import("@/lib/api/clients");
}

function getRedisFromEnvMockCalls(): Array<[RedisFromEnvOptions]> {
  return sharedRedisFromEnvMock.mock.calls as unknown as Array<
    [RedisFromEnvOptions]
  >;
}

describe("lib/api/clients", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NODE_ENV: "test",
    };
    mock.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
    mock.clearAllMocks();
  });

  it("keeps Redis latency logging disabled by default", async () => {
    const { createRealRedisClient, resetRealRedisClientForTests } =
      await importClientsModule();

    resetRealRedisClientForTests();

    createRealRedisClient();

    expect(getRedisFromEnvMockCalls().at(-1)?.[0]).toMatchObject({
      enableAutoPipelining: true,
      latencyLogging: false,
      retry: expect.objectContaining({
        retries: 3,
      }),
    });
  });

  it("preserves the production Redis env guard", async () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: "production",
    };
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    const { createRealRedisClient, resetRealRedisClientForTests } =
      await importClientsModule();

    resetRealRedisClientForTests();

    expect(() => createRealRedisClient()).toThrow(
      /UPSTASH_REDIS_REST_(URL|TOKEN)/,
    );
  });
});
