import { NextResponse } from "next/server";
import { redisClient, incrementAnalytics } from "@/lib/api-utils";
import { CardsRecord } from "@/lib/types/records";
import { safeParse } from "@/lib/utils";

/**
 * Serves cached card configurations for the requested user from Redis.
 * @param request - HTTP request carrying the userId query and related headers.
 * @returns JSON response containing the card data or an explanatory error payload.
 * @source
 */
export async function GET(request: Request) {
  const startTime = Date.now();
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const ip = request.headers.get("x-forwarded-for") || "unknown IP";
  console.log(`🚀 [Cards API] New request from ${ip} for userId: ${userId}`);

  if (!userId) {
    console.warn("⚠️ [Cards API] Missing user ID parameter");
    return NextResponse.json(
      { error: "Missing user ID parameter" },
      { status: 400 },
    );
  }

  const numericUserId = Number.parseInt(userId);
  if (Number.isNaN(numericUserId)) {
    console.warn(`⚠️ [Cards API] Invalid user ID format: ${userId}`);
    incrementAnalytics("analytics:cards_api:failed_requests").catch(() => {});
    return NextResponse.json(
      { error: "Invalid user ID format" },
      { status: 400 },
    );
  }

  try {
    console.log(
      `🔍 [Cards API] Fetching card configuration from Redis for user ${numericUserId}`,
    );
    const key = `cards:${numericUserId}`;
    const cardDataStr = await redisClient.get(key);
    const duration = Date.now() - startTime;

    if (!cardDataStr) {
      console.warn(
        `⚠️ [Cards API] Cards for user ${numericUserId} not found [${duration}ms]`,
      );
      return NextResponse.json({ error: "Cards not found" }, { status: 404 });
    }

    const cardData: CardsRecord = safeParse<CardsRecord>(cardDataStr);
    console.log(
      `✅ [Cards API] Successfully returned card data for user ${numericUserId} [${duration}ms]`,
    );

    if (duration > 500) {
      console.warn(
        `⏳ [Cards API] Slow response time: ${duration}ms for user ${numericUserId}`,
      );
    }
    incrementAnalytics("analytics:cards_api:successful_requests").catch(
      () => {},
    );
    return NextResponse.json(cardData);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(
      `🔥 [Cards API] Error for user ${numericUserId} [${duration}ms]: ${error.message}`,
    );
    if (error.stack) {
      console.error(`💥 [Cards API] Stack Trace: ${error.stack}`);
    }
    incrementAnalytics("analytics:cards_api:failed_requests").catch(() => {});
    return NextResponse.json(
      { error: "Failed to fetch cards" },
      { status: 500 },
    );
  }
}
