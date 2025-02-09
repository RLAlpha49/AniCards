import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { MongoClient, ServerApiVersion } from "mongodb";
import { animeStatsTemplate } from "@/lib/svg-templates/anime-stats";
import { CardConfig, UserStats } from "@/lib/types/card";
import { calculateMilestones } from "@/lib/utils/milestones";
import { mangaStatsTemplate } from "@/lib/svg-templates/manga-stats";
import { socialStatsTemplate } from "@/lib/svg-templates/social-stats";
import { extraAnimeMangaStatsTemplate } from "@/lib/svg-templates/extra-anime-manga-stats";

const ratelimit = new Ratelimit({
	redis: Redis.fromEnv(),
	limiter: Ratelimit.slidingWindow(15, "10 s"),
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

type CategoryKey = "genres" | "tags" | "voiceactors" | "studios" | "staff";

type GenreItem = { genre: string; count: number };
type TagItem = { tag: { name: string }; count: number };
type VoiceActorItem = { voiceActor: { name: { full: string } }; count: number };
type StudioItem = { studio: { name: string }; count: number };
type StaffItem = { staff: { name: { full: string } }; count: number };

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
		"Cache-Control": "public, max-age=86400, stale-while-revalidate=86400",
		"Access-Control-Allow-Origin": "https://anilist.co",
		"Access-Control-Allow-Methods": "GET",
		Vary: "Origin",
	};
}

function errorHeaders() {
	return {
		"Content-Type": "image/svg+xml",
		"Cache-Control": "no-store, max-age=0, must-revalidate",
		"Access-Control-Allow-Origin": "https://anilist.co",
		"Access-Control-Allow-Methods": "GET",
		Vary: "Origin",
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
					...milestoneData,
				},
			});
			break;

		case "socialStats":
			svgContent = socialStatsTemplate({
				username: userStats.username,
				styles: {
					titleColor: cardConfig.titleColor,
					backgroundColor: cardConfig.backgroundColor,
					textColor: cardConfig.textColor,
					circleColor: cardConfig.circleColor,
				},
				stats: userStats.stats,
				activityHistory: userStats.stats.User.stats.activityHistory,
			});
			break;

		case "animeGenres":
		case "animeTags":
		case "animeVoiceActors":
		case "animeStudios":
		case "animeStaff":
		case "mangaGenres":
		case "mangaTags":
		case "mangaStaff":
			const isAnime = cardConfig.cardName.startsWith("anime");
			const categoryMap: Record<CategoryKey, string> = {
				genres: "genres",
				tags: "tags",
				voiceactors: "voiceActors",
				studios: "studios",
				staff: "staff",
			};
			const categoryKey =
				categoryMap[
					cardConfig.cardName
						.replace(isAnime ? "anime" : "manga", "")
						.toLowerCase() as CategoryKey
				];
			const stats = isAnime
				? userStats.stats.User.statistics.anime
				: userStats.stats.User.statistics.manga;

			const items =
				stats[categoryKey]
					?.slice(0, 5)
					.map((item: GenreItem | TagItem | VoiceActorItem | StudioItem | StaffItem) => {
						switch (categoryKey) {
							case "genres":
								return { name: (item as GenreItem).genre, count: item.count };
							case "tags":
								return { name: (item as TagItem).tag.name, count: item.count };
							case "voiceActors":
								return {
									name: (item as VoiceActorItem).voiceActor.name.full,
									count: item.count,
								};
							case "studios":
								return {
									name: (item as StudioItem).studio.name,
									count: item.count,
								};
							case "staff":
								return {
									name: (item as StaffItem).staff.name.full,
									count: item.count,
								};
							default:
								return { name: "", count: 0 };
						}
					}) || [];

			svgContent = extraAnimeMangaStatsTemplate({
				username: userStats.username,
				styles: {
					titleColor: cardConfig.titleColor,
					backgroundColor: cardConfig.backgroundColor,
					textColor: cardConfig.textColor,
					circleColor: cardConfig.circleColor,
				},
				format: isAnime ? "anime" : "manga",
				stats: items,
			});
			break;

		default:
			throw new Error("Unsupported card type");
	}

	return svgContent;
}

export async function GET(request: Request) {
	const startTime = Date.now();
	const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";
	const { success } = await ratelimit.limit(ip);

	if (!success) {
		return new Response(svgError("Too many requests - try again later"), {
			headers: errorHeaders(),
			status: 429,
		});
	}

	const { searchParams } = new URL(request.url);
	const userId = searchParams.get("userId");
	const cardType = searchParams.get("cardType");

	console.log(`🖼️ [Card SVG] Request for ${cardType} card - User ID: ${userId}`);

	if (!userId || !cardType) {
		const missingParam = !userId ? "userId" : "cardType";
		console.warn(`⚠️ [Card SVG] Missing parameter: ${missingParam}`);
		return new Response(svgError("Missing parameters"), {
			headers: errorHeaders(),
			status: 200,
		});
	}

	if (!ALLOWED_CARD_TYPES.has(cardType)) {
		console.warn(`⚠️ [Card SVG] Invalid card type: ${cardType}`);
		return new Response(svgError("Invalid card type"), {
			headers: errorHeaders(),
			status: 200,
		});
	}

	const numericUserId = parseInt(userId);
	if (isNaN(numericUserId)) {
		console.warn(`⚠️ [Card SVG] Invalid user ID format: ${userId}`);
		return new Response(svgError("Invalid user ID"), {
			headers: errorHeaders(),
			status: 200,
		});
	}

	try {
		console.log(`🔍 [Card SVG] Fetching data for user ${numericUserId}`);
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
				userId: numericUserId,
				"cards.cardName": cardType,
			}),
			db.collection("users").findOne({
				userId: numericUserId,
			}),
		]);

		if (!cardDoc || !userDoc) {
			console.warn(`⚠️ [Card SVG] User ${numericUserId} not found`);
			return new Response(svgError("User data not found"), {
				headers: errorHeaders(),
				status: 200,
			});
		}

		const cardConfig = cardDoc.cards.find((c: CardConfig) => c.cardName === cardType);

		console.log(`🎨 [Card SVG] Generating ${cardType} SVG for user ${numericUserId}`);
		try {
			const svgContent = generateCardSVG(cardConfig, userDoc as unknown as UserStats);
			const duration = Date.now() - startTime;
			console.log(
				`✅ [Card SVG] Rendered ${cardType} card for ${numericUserId} [${duration}ms]`
			);
			return new Response(svgContent, {
				headers: svgHeaders(),
			});
		} catch (error) {
			console.error("Card generation failed:", error);
			const duration = Date.now() - startTime;
			console.error(`🔥 [Card SVG] Error after ${duration}ms:`, error);
			return new Response(svgError("Server Error"), {
				headers: errorHeaders(),
				status: 200,
			});
		}
	} catch (error) {
		console.error("Card generation failed:", error);
		const duration = Date.now() - startTime;
		console.error(`🔥 [Card SVG] Error after ${duration}ms:`, error);
		return new Response(svgError("Server Error"), {
			headers: errorHeaders(),
			status: 200,
		});
	}
}
