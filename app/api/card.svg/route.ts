import { NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { MongoClient } from "mongodb";
import { ServerApiVersion } from "mongodb";
import { animeStatsTemplate } from "@/lib/svg-templates/anime-stats";
import { CardConfig, UserStats } from "@/lib/types/card";
import { calculateMilestones } from "@/lib/utils/milestones";
import { mangaStatsTemplate } from "@/lib/svg-templates/manga-stats";

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
		"Cache-Control": "public, max-age=60",
		"Access-Control-Allow-Origin": "*",
	};
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function generateCardSVG(cardConfig: CardConfig, userStats: any) {
	if (!cardConfig || !userStats?.stats?.User?.statistics?.anime) {
		throw new Error("Missing card configuration or stats data");
	}
	let milestoneData;
	let svgContent: string;

	switch (cardConfig.cardName) {
		case "animeStats":
			const episodesWatched = userStats.stats.User.statistics.anime.episodesWatched;
			milestoneData = calculateMilestones(episodesWatched);

			svgContent = animeStatsTemplate({
				username: userStats.username,
				styles: {
					titleColor: cardConfig.titleColor,
					backgroundColor: cardConfig.backgroundColor,
					textColor: cardConfig.textColor,
					circleColor: cardConfig.circleColor,
				},
				stats: {
					...userStats.stats.User.statistics.anime,
					...milestoneData,
				},
			});
			break;

		case "mangaStats":
			const chaptersRead = userStats.stats.User.statistics.manga.chaptersRead;
			milestoneData = calculateMilestones(chaptersRead);
			
			svgContent = mangaStatsTemplate({
				username: userStats.username,
				styles: {
					titleColor: cardConfig.titleColor,
					backgroundColor: cardConfig.backgroundColor,
					textColor: cardConfig.textColor,
					circleColor: cardConfig.circleColor,
				},
				stats: {
					...userStats.stats.User.statistics.manga,
					...milestoneData
				}
			});
			break;
		default:
			throw new Error("Unsupported card type");
	}

	return svgContent;
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

		const [cardDoc, userDoc] = await Promise.all([
			db.collection("cards").findOne({
				userId: parseInt(userId),
				"cards.cardName": cardType,
			}),
			db.collection("users").findOne({
				userId: parseInt(userId),
			}),
		]);

		if (!cardDoc || !userDoc) {
			return new Response(svgError("User data not found"), {
				headers: svgHeaders(),
				status: 200,
			});
		}

		const cardConfig = cardDoc.cards.find((c: CardConfig) => c.cardName === cardType);

		try {
			const svgContent = generateCardSVG(cardConfig, userDoc as unknown as UserStats);
			return new Response(svgContent, {
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
