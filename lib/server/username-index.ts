import type { Redis } from "@upstash/redis";

export const REMOVE_USERNAME_INDEX_IF_OWNED_SCRIPT = `
  if redis.call("GET", KEYS[1]) == ARGV[1] then
    return redis.call("DEL", KEYS[1])
  end
  return 0
`;

export function buildUsernameIndexKey(username: string | undefined): string | null {
  const normalizedUsername = username?.trim().toLowerCase();
  return normalizedUsername ? `username:${normalizedUsername}` : null;
}

export async function syncUsernameIndex(
  redisClient: Redis,
  previousUsernameIndexKey: string | null,
  currentUsernameIndexKey: string | null,
  userId: string | number,
): Promise<boolean> {
  const userIdValue = String(userId);
  if (currentUsernameIndexKey) {
    await redisClient.set(currentUsernameIndexKey, userIdValue);
  }
  if (!previousUsernameIndexKey || previousUsernameIndexKey === currentUsernameIndexKey) {
    return false;
  }
  const removed = await redisClient.eval<[string], number>(
    REMOVE_USERNAME_INDEX_IF_OWNED_SCRIPT,
    [previousUsernameIndexKey],
    [userIdValue],
  );
  return removed === 1;
}