import { NextResponse } from "next/server";
import { redisClient, incrementAnalytics } from "@/lib/api-utils";
import { UserRecord } from "@/lib/types/records";
import { safeParse } from "@/lib/utils";

// API endpoint for fetching user data from Redis.
// Accepts either a userId or username parameter.
// If only username is provided, it uses the username index to infer the userId.
export async function GET(request: Request) {
  const startTime = Date.now();
  const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";
  console.log(`🚀 [User API] Received request from IP: ${ip}`);

  const { searchParams } = new URL(request.url);
  const userIdParam = searchParams.get("userId");
  const usernameParam = searchParams.get("username");

  if (!userIdParam && !usernameParam) {
    console.warn("⚠️ [User API] Missing userId or username parameter");
    incrementAnalytics("analytics:user_api:failed_requests").catch(() => {});
    return NextResponse.json(
      { error: "Missing userId or username parameter" },
      { status: 400 },
    );
  }
  let numericUserId: number | null = null;
  let key: string;

  if (userIdParam) {
    numericUserId = Number.parseInt(userIdParam, 10);
    if (Number.isNaN(numericUserId)) {
      console.warn(
        `⚠️ [User API] Invalid userId parameter provided: ${userIdParam}`,
      );
      incrementAnalytics("analytics:user_api:failed_requests").catch(() => {});
      return NextResponse.json(
        { error: "Invalid userId parameter" },
        { status: 400 },
      );
    }
    key = `user:${numericUserId}`;
    console.log(`🚀 [User API] Request received for userId: ${numericUserId}`);
  } else {
    // Use the username parameter: normalize it and use the username index key.
    const normalizedUsername = usernameParam!.trim().toLowerCase();
    const usernameIndexKey = `username:${normalizedUsername}`;
    console.log(
      `🔍 [User API] Searching user index for username: ${normalizedUsername}`,
    );
    const userIdFromIndex = await redisClient.get(usernameIndexKey);
    if (!userIdFromIndex) {
      console.warn(
        `⚠️ [User API] User not found for username: ${normalizedUsername}`,
      );
      incrementAnalytics("analytics:user_api:failed_requests").catch(() => {});
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    numericUserId = Number.parseInt(userIdFromIndex as string, 10);
    if (Number.isNaN(numericUserId)) {
      console.warn(
        `⚠️ [User API] Invalid userId value from username index for username: ${normalizedUsername}`,
      );
      incrementAnalytics("analytics:user_api:failed_requests").catch(() => {});
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    key = `user:${numericUserId}`;
    console.log(
      `🚀 [User API] Request received for username: ${normalizedUsername} (userId: ${numericUserId})`,
    );
  }

  try {
    const userDataRaw = await redisClient.get(key);
    const duration = Date.now() - startTime;
    if (!userDataRaw) {
      console.warn(
        `⚠️ [User API] User record not found for key ${key} [${duration}ms]`,
      );
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userData: UserRecord = safeParse<UserRecord>(userDataRaw);
    console.log(
      `✅ [User API] Successfully fetched user data for user ${numericUserId} [${duration}ms]`,
    );
    incrementAnalytics("analytics:user_api:successful_requests").catch(
      () => {},
    );
    return NextResponse.json(userData);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(
      `🔥 [User API] Error fetching user data for key ${key} [${duration}ms]: ${error.message}`,
    );
    if (error.stack) {
      console.error(`💥 [User API] Stack Trace: ${error.stack}`);
    }
    incrementAnalytics("analytics:user_api:failed_requests").catch(() => {});
    return NextResponse.json(
      { error: "Failed to fetch user data" },
      { status: 500 },
    );
  }
}
