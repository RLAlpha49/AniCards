import { NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { MongoClient } from "mongodb";
import { ServerApiVersion } from "mongodb";
import { animeStatsTemplate } from "@/lib/svg-templates/anime-stats";
import { CardConfig, UserStats } from "@/lib/types/card";

const ratelimit = new Ratelimit({
	redis: Redis.fromEnv(),
	limiter: Ratelimit.slidingWindow(10, "10 s"),
});

const ALLOWED_CARD_TYPES = new Set([
	"animeStats",
	"socialStats",
	"mangaStats",
	"animeGenres",
	"animeTags",
	"animeVoiceActors",
	"animeStudios",
	"animeStudios",
	"animeStaff",
	"mangaGenres",
	"mangaTags",
	"mangaStaff",
]);

function svgError(message: string) {
	return `<?xml version="1.0" encoding="UTF-8"?>
  <!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
  <svg width="800" height="400" viewBox="0 0 800 400" xmlns="http://www.w3.org/2000/svg">
    <style>
      .error-text {
        font-family: monospace;
        font-size: 20px;
        fill: #ff5555;
      }
    </style>
    <rect width="100%" height="100%" fill="#1a1a1a"/>
    <text x="50%" y="50%" class="error-text" 
          text-anchor="middle" dominant-baseline="middle">
      ${message}
    </text>
  </svg>`;
}

function svgHeaders() {
	return {
		"Content-Type": "image/svg+xml",
		"Cache-Control": "public, max-age=600",
		"Access-Control-Allow-Origin": "*",
	};
}

function generateCardSVG(cardConfig: CardConfig, userStats: UserStats) {
	console.log(cardConfig, userStats);
	if (!cardConfig || !userStats?.User?.statistics?.anime) {
		throw new Error("Missing card configuration or stats data");
	}

	switch (cardConfig.cardName) {
		case "animeStats":
			return animeStatsTemplate({
				username: userStats.username,
				styles: {
					titleColor: cardConfig.titleColor,
					backgroundColor: cardConfig.backgroundColor,
					textColor: cardConfig.textColor,
					circleColor: cardConfig.circleColor,
				},
				stats: {
					count: userStats.User.statistics.anime.count,
					episodesWatched: userStats.User.statistics.anime.episodesWatched,
					minutesWatched: userStats.User.statistics.anime.minutesWatched,
					meanScore: userStats.User.statistics.anime.meanScore,
					standardDeviation: userStats.User.statistics.anime.standardDeviation,

					current_milestone: userStats.User.statistics.anime.current_milestone,
				},
			});

		default:
			throw new Error("Unsupported card type");
	}
}

export async function GET(request: Request) {
	const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";
	const { success } = await ratelimit.limit(ip);

	if (!success) {
		return NextResponse.json({ error: "Too many requests" }, { status: 429 });
	}

	const { searchParams } = new URL(request.url);
	const userId = searchParams.get("userId");
	const cardType = searchParams.get("cardType");

	try {
		if (!userId || !cardType) {
			return new Response(svgError("Missing user ID or card type"), {
				headers: svgHeaders(),
				status: 400,
			});
		}

		if (!ALLOWED_CARD_TYPES.has(cardType)) {
			return new Response(svgError("Invalid card type"), {
				headers: svgHeaders(),
				status: 400,
			});
		}

		const client = new MongoClient(process.env.MONGODB_URI!, {
			serverApi: {
				version: ServerApiVersion.v1,
				strict: true,
				deprecationErrors: true,
			},
		});
		const db = client.db("anicards");

		console.log("Fetching user:", userId);
		const [cardDoc, userDoc] = await Promise.all([
			db.collection("cards").findOne({
				userId: parseInt(userId),
				"cards.cardName": cardType,
			}),
			db.collection("users").findOne({
				userId: parseInt(userId),
			}),
		]);

		console.log("User document exists:", !!userDoc);
		console.log("Card document exists:", !!cardDoc);

		if (!cardDoc || !userDoc) {
			console.log("Missing document:", {
				userExists: !!userDoc,
				cardExists: !!cardDoc,
			});
			return new Response(svgError("User data not found"), {
				headers: svgHeaders(),
				status: 200,
			});
		}

		const cardConfig = cardDoc.cards.find((c: CardConfig) => c.cardName === cardType);

		try {
			return new Response(generateCardSVG(cardConfig, userDoc.stats), {
				headers: {
					"Content-Type": "image/svg+xml",
					"Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
				},
			});
		} catch (error) {
			console.error("Card generation failed:", error);
			return new Response(svgError("Server Error"), {
				headers: svgHeaders(),
				status: 200,
			});
		}
	} catch (error) {
		console.error("Card generation failed:", error);
		return new Response(svgError("Server Error"), {
			headers: svgHeaders(),
			status: 200,
		});
	}
}
