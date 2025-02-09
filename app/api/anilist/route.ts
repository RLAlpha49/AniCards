import { NextResponse } from "next/server";

export async function POST(request: Request) {
	const startTime = Date.now();
	let operationName = "unknown";

	try {
		const { query, variables } = await request.json();

		operationName = query.match(/query\s+(\w+)/)?.[1] || "anonymous_query";
		const anilistUserId = variables?.userId ? String(variables.userId) : "unknown";

		console.log(`🔵 AniList Request: ${operationName} for user ${anilistUserId}`);

		const response = await fetch("https://graphql.anilist.co", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json",
				Authorization: `Bearer ${process.env.ANILIST_TOKEN}`,
			},
			body: JSON.stringify({ query, variables }),
		});

		const duration = Date.now() - startTime;
		console.log(`🟢 AniList Response: ${operationName} [${response.status}] ${duration}ms`);

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
		console.error(`🔴 AniList Failed: ${operationName} [${duration}ms] - ${error.message}`);
		return NextResponse.json({ error: "Failed to fetch AniList data" }, { status: 500 });
	}
}
