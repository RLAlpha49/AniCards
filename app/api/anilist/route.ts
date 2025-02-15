import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";

// Proxy endpoint for AniList GraphQL API with testing simulations
export async function POST(request: Request) {
	/* Development environment test simulations:
	- Simulates 429 rate limit responses
	- Simulates 500 server errors
	- Activated via X-Test-Status header */
	if (process.env.NODE_ENV === "development") {
		const testHeader = request.headers.get("X-Test-Status");
		if (testHeader === "429") {
			return NextResponse.json(
				{ error: "Rate limited (test simulation)" },
				{
					status: 429,
					headers: { "Retry-After": "60" }, // Standard rate limit header
				}
			);
		} else if (testHeader === "500") {
			return NextResponse.json(
				{ error: "Internal server error (test simulation)" },
				{ status: 500 }
			);
		}
	}

	const startTime = Date.now();
	let operationName = "unknown";
	let userIdentifier = "not_provided";

	try {
		const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";
		console.log(`🚀 [AniList API] Incoming request from IP: ${ip}`);

		// Extract operation details from GraphQL query
		const { query, variables } = await request.json();
		/* Operation name extraction:
		   - Matches query/mutation keyword
		   - Captures operation name
		   - Fallback to 'anonymous_operation' */
		operationName = query.match(/(query|mutation)\s+(\w+)/)?.[2] || "anonymous_operation";

		// User identification logic based on operation.
		if (operationName === "GetUserId") {
			userIdentifier = variables?.userName ? String(variables.userName) : "no_username";
		} else if (operationName === "GetUserStats") {
			userIdentifier = variables?.userId ? String(variables.userId) : "no_userid";
		}

		console.log(`🚀 [AniList API] Anilist request: ${operationName} for ${userIdentifier}`);

		// Forward request to AniList API
		const response = await fetch("https://graphql.anilist.co", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json",
				Authorization: `Bearer ${process.env.ANILIST_TOKEN}`, // API authentication
				// Pass through test headers in development
				...(process.env.NODE_ENV === "development" && {
					"X-Test-Status": request.headers.get("X-Test-Status") || "",
				}),
			},
			body: JSON.stringify({ query, variables }),
		});

		const duration = Date.now() - startTime;

		// Log a warning if this request took longer than expected
		if (duration > 1000) {
			console.warn(
				`⏳ [AniList API] Slow request detected: ${operationName} took ${duration}ms`
			);
		}

		console.log(
			`✅ [AniList API] Anilist response: ${operationName} [${response.status}] ${duration}ms | Identifier: ${userIdentifier}`
		);

		// Handle API response errors
		if (!response.ok) {
			console.error(
				`🔥 [AniList API] Anilist error: ${operationName} HTTP ${response.status}`
			);
			const analyticsClient = Redis.fromEnv();
			analyticsClient.incr("analytics:anilist_api:failed_requests").catch(() => {});

			const retryAfter = response.headers.get("retry-after");
			const retryAfterMsg = retryAfter ? ` (Retry-After: ${retryAfter})` : "";

			// Try to parse error details from the response
			const errorData = await response.json();
			const errorMessage =
				typeof errorData.error === "object"
					? JSON.stringify(errorData.error)
					: errorData.error || `HTTP error! status: ${response.status}`;

			if (response.status === 429) {
				throw new Error(`HTTP error! status: ${response.status} - ${errorMessage} - Rate limited${retryAfterMsg}`);
			} else if (response.status === 500) {
				throw new Error(`HTTP error! status: ${response.status} - ${errorMessage} - Server error${retryAfterMsg}`);
			} else {
				throw new Error(`HTTP error! status: ${response.status} - ${errorMessage}${retryAfterMsg}`);
			}
		}

		// Handle GraphQL errors
		const json = await response.json();
		if (json.errors) {
			console.error(
				`🔥 [AniList API] Anilist GraphQL error: ${operationName} - ${json.errors[0].message}`
			);
			const analyticsClient = Redis.fromEnv();
			analyticsClient.incr("analytics:anilist_api:failed_requests").catch(() => {});
			throw new Error(json.errors[0].message);
		}

		console.log(`✅ [AniList API] Anilist operation ${operationName} completed successfully.`);
		const analyticsClient = Redis.fromEnv();
		analyticsClient.incr("analytics:anilist_api:successful_requests").catch(() => {});
		return NextResponse.json(json.data);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} catch (error: any) {
		const duration = Date.now() - startTime;
		console.error(
			`🔥 [AniList API] Anilist failed: ${operationName} [${duration}ms] | Identifier: ${userIdentifier} - ${error.message}`
		);
		// If an error stack is available, log it for better debugging.
		if (error.stack) {
			console.error(`💥 [AniList API] Stack Trace: ${error.stack}`);
		}
		// Try to detect the HTTP status code from the error message (if present)
		const statusMatch = error.message && error.message.match(/status:\s?(\d+)/);
		const statusCode = statusMatch ? parseInt(statusMatch[1], 10) : 500;
		const analyticsClient = Redis.fromEnv();
		analyticsClient.incr("analytics:anilist_api:failed_requests").catch(() => {});
		// Return the error details so the UI can show them
		return NextResponse.json(
			{ error: error.message || "Failed to fetch AniList data" },
			{ status: statusCode }
		);
	}
}
