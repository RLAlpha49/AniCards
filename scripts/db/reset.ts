import { Redis } from "@upstash/redis";
import { assertLocalRedis } from "../lib/env";

const DEFAULT_LOCAL_REDIS_URL = "http://localhost:8079";
const DEFAULT_LOCAL_REDIS_TOKEN = "local_dev_token";

async function main(): Promise<void> {
  const url =
    process.env.LOCAL_REDIS_URL ??
    process.env.UPSTASH_REDIS_REST_URL ??
    DEFAULT_LOCAL_REDIS_URL;
  assertLocalRedis(url, "reset");

  const token =
    process.env.LOCAL_REDIS_TOKEN ??
    process.env.UPSTASH_REDIS_REST_TOKEN ??
    DEFAULT_LOCAL_REDIS_TOKEN;
  const redis = new Redis({ url, token });
  const pong = await redis.ping();
  if (pong !== "PONG") throw new Error("Local Redis did not return PONG.");

  let cursor: string | number = 0;
  let deletedKeys = 0;

  do {
    const [nextCursor, keys] = (await redis.scan(cursor, {
      match: "*",
      count: 500,
    })) as [string | number, string[]];
    cursor = nextCursor;

    if (keys.length > 0) {
      deletedKeys += await redis.del(...keys);
    }
  } while (cursor !== 0 && cursor !== "0");

  console.log(`Deleted ${deletedKeys} keys from local Redis at ${url}.`);
}

main().catch((error: unknown) => {
  console.error("Local Redis reset failed:", error);
  process.exitCode = 1;
});
