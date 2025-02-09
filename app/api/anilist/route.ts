import { NextResponse } from "next/server";

export async function POST(request: Request) {
	if (process.env.NODE_ENV === "development") {
		const testHeader = request.headers.get("X-Test-Status");
		if (testHeader === "429") {
			console.log("⚠️ Simulating 429 response for testing");
			return NextResponse.json(
				{ error: "Rate limited (test simulation)" },
				{ 
					status: 429,
					headers: { "Retry-After": "60" }
				}
			);
		} else if (testHeader === "500") {
			console.log("⚠️ Simulating 500 response for testing");
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
		const { query, variables } = await request.json();

		operationName = query.match(/(query|mutation)\s+(\w+)/)?.[2] || "anonymous_operation";

		if (operationName === "GetUserId") {
			userIdentifier = variables?.userName ? String(variables.userName) : "no_username";
		} else if (operationName === "GetUserStats") {
			userIdentifier = variables?.userId ? String(variables.userId) : "no_userid";
		}

		console.log(`🔵 AniList Request: ${operationName} for ${userIdentifier}`);

		const response = await fetch("https://graphql.anilist.co", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json",
				Authorization: `Bearer ${process.env.ANILIST_TOKEN}`,
				...(process.env.NODE_ENV === "development" && {
					"X-Test-Status": request.headers.get("X-Test-Status") || "",
				}),
			},
			body: JSON.stringify({ query, variables }),
		});

		const duration = Date.now() - startTime;
		console.log(
			`🟢 AniList Response: ${operationName} [${response.status}] ${duration}ms | Identifier: ${userIdentifier}`
		);

		if (!response.ok) {
			console.error(`🔴 AniList Error: ${operationName} HTTP ${response.status}`);
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		const json = await response.json();
		if (json.errors) {
			console.error(`🔴 AniList GraphQL Error: ${operationName} - ${json.errors[0].message}`);
			throw new Error(json.errors[0].message);
		}

		return NextResponse.json(json.data);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} catch (error: any) {
		const duration = Date.now() - startTime;
		console.error(
			`🔴 AniList Failed: ${operationName} [${duration}ms] | Identifier: ${userIdentifier} - ${error.message}`
		);
		return NextResponse.json({ error: "Failed to fetch AniList data" }, { status: 500 });
	}
}
