import { NextResponse } from "next/server";

export async function POST(request: Request) {
	try {
		const { query, variables } = await request.json();

		const response = await fetch("https://graphql.anilist.co", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json",
				Authorization: `Bearer ${process.env.ANILIST_TOKEN}`,
			},
			body: JSON.stringify({ query, variables }),
		});

		if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

		const json = await response.json();
		if (json.errors) throw new Error(json.errors[0].message);

		return NextResponse.json(json.data);
	} catch (error) {
		console.error("AniList API error:", error);
		return NextResponse.json({ error: "Failed to fetch AniList data" }, { status: 500 });
	}
}
