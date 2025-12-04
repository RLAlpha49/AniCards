import { NextResponse } from "next/server";
import { warmSvgCache, getTopRequestedUsers } from "@/lib/stores/svg-cache";
import { apiJsonHeaders } from "@/lib/api-utils";

/**
 * Validates the cron secret header and returns an error response on failure.
 * @param request - Incoming request whose headers provide the cron secret.
 * @returns Response when authorization fails or null when allowed.
 * @source
 */
function checkCronAuthorization(request: Request): NextResponse | null {
  const secret = request.headers.get("authorization");
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret) {
    console.error("🚨 [Cache Warming] CRON_SECRET not configured");
    return NextResponse.json(
      { error: "Server not configured" },
      {
        status: 500,
        headers: apiJsonHeaders(),
      },
    );
  }

  if (secret !== `Bearer ${expectedSecret}`) {
    console.warn("🚨 [Cache Warming] Unauthorized cron attempt");
    return NextResponse.json(
      { error: "Unauthorized" },
      {
        status: 401,
        headers: apiJsonHeaders(),
      },
    );
  }

  return null;
}

/**
 * POST handler for the cache warming cron job.
 * Warms the in-memory LRU cache by pre-loading popular user cards.
 *
 * Query parameters:
 * - topN (optional): Number of top users to warm (default: 100)
 * - cardTypes (optional): Comma-separated card types to warm (default: animeStats,mangaStats,socialStats,animeGenres)
 *
 * @param request - Incoming POST request for the cache warming endpoint.
 * @returns HTTP response with warming statistics or an error.
 * @source
 */
export async function POST(request: Request): Promise<NextResponse> {
  // Check authorization
  const authError = checkCronAuthorization(request);
  if (authError) {
    return authError;
  }

  const startTime = Date.now();
  console.log("🛠️ [Cache Warming] Starting SVG cache warming job...");

  try {
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const topN = Math.min(
      100,
      Math.max(10, Number.parseInt(searchParams.get("topN") ?? "100") || 100),
    );
    const cardTypesParam = searchParams.get("cardTypes");
    const cardTypes = cardTypesParam
      ? cardTypesParam.split(",").map((t) => t.trim())
      : ["animeStats", "mangaStats", "socialStats", "animeGenres"];

    // Get top requested users
    const topUsers = getTopRequestedUsers(topN);

    if (topUsers.length === 0) {
      console.log("ℹ️ [Cache Warming] No user request data available yet");
      return NextResponse.json({
        success: true,
        message: "No users to warm",
        stats: {
          attemptedCount: 0,
          successCount: 0,
          failureCount: 0,
        },
        duration: Date.now() - startTime,
      });
    }

    // Perform cache warming
    const stats = await warmSvgCache(topUsers, cardTypes);
    const duration = Date.now() - startTime;

    console.log(
      `✅ [Cache Warming] Completed in ${duration}ms - Success: ${stats.successCount}/${stats.attemptedCount}`,
    );

    return NextResponse.json({
      success: true,
      stats,
      duration,
      topUsersCount: topUsers.length,
      cardTypes,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`🔥 [Cache Warming] Error after ${duration}ms:`, error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        duration,
      },
      { status: 500, headers: apiJsonHeaders() },
    );
  }
}

export function OPTIONS(request: Request) {
  return new NextResponse(null, {
    headers: {
      "Access-Control-Allow-Origin": request.headers.get("origin") ?? "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
