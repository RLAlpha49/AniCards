import { NextResponse } from "next/server";
import { UserRecord } from "@/lib/types/records";
import { safeParse } from "@/lib/utils";
import {
  checkRateLimit,
  validateAuth,
  incrementAnalytics,
  logRequest,
  handleError,
  logSuccess,
  redisClient,
} from "@/lib/api-utils";

// API endpoint for storing/updating user data using Redis as the persistent store
export async function POST(request: Request): Promise<NextResponse> {
  const startTime = Date.now();
  const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";
  const endpoint = "Store Users";

  logRequest(endpoint, ip);

  // Check rate limit
  const rateLimitResponse = await checkRateLimit(ip, endpoint);
  if (rateLimitResponse) return rateLimitResponse;

  // Validate authentication
  const authToken = request.headers.get("Authorization");
  const authResponse = validateAuth(authToken, ip, endpoint);
  if (authResponse) return authResponse;

  try {
    const data = await request.json();
    console.log(
      `📝 [${endpoint}] Processing user ${data.userId} (${data.username || "no username"})`,
    );

    // Define a Redis key for the user data
    const userKey = `user:${data.userId}`;
    let createdAt = new Date().toISOString();

    // Retrieve the stored record from Redis
    const storedRecordRaw = await redisClient.get(userKey);
    if (storedRecordRaw) {
      console.log(
        `🔍 [${endpoint}] Found existing record for user ${data.userId}`,
      );
      try {
        // Directly parse the JSON string from Redis
        const parsedUser = safeParse<UserRecord>(storedRecordRaw);
        createdAt = parsedUser.createdAt || createdAt;
      } catch (error) {
        console.error(
          `🔥 [${endpoint}] Failed to parse user record from Redis. Data received: ${storedRecordRaw}`,
        );
        if (error instanceof Error && error.stack) {
          console.error(`💥 [${endpoint}] Stack Trace: ${error.stack}`);
        }
      }
    } else {
      console.log(
        `📝 [${endpoint}] No existing record found for user ${data.userId}. Creating new record.`,
      );
    }

    const userData: UserRecord = {
      userId: data.userId,
      username: data.username,
      stats: data.stats,
      ip,
      createdAt,
      updatedAt: new Date().toISOString(),
    };

    console.log(
      `📝 [${endpoint}] Saving user data to Redis under key: ${userKey}`,
    );
    // Save (or update) the user data in Redis
    await redisClient.set(userKey, JSON.stringify(userData));

    // Create/update the username index if a username is provided.
    if (data.username) {
      const normalizedUsername = data.username.trim().toLowerCase();
      const usernameIndexKey = `username:${normalizedUsername}`;
      console.log(
        `📝 [${endpoint}] Updating username index for: ${normalizedUsername}`,
      );
      await redisClient.set(usernameIndexKey, data.userId.toString());
    }

    const duration = Date.now() - startTime;
    logSuccess(endpoint, data.userId, duration);
    await incrementAnalytics("analytics:store_users:successful_requests");

    return NextResponse.json({
      success: true,
      userId: data.userId,
    });
  } catch (error) {
    return handleError(
      error as Error,
      endpoint,
      startTime,
      "analytics:store_users:failed_requests",
    );
  }
}
