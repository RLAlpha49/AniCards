import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { CardConfig, UserStats } from "@/lib/types/card";
import { calculateMilestones } from "@/lib/utils/milestones";
import { socialStatsTemplate } from "@/lib/svg-templates/social-stats";
import { extraAnimeMangaStatsTemplate } from "@/lib/svg-templates/extra-anime-manga-stats";
import { safeParse } from "@/lib/utils";
import { UserRecord } from "@/lib/types/records";
import { CardsRecord } from "@/lib/types/records";
import { mediaStatsTemplate } from "@/lib/svg-templates/media-stats";

// Rate limiter setup using Upstash Redis
const redisClient = Redis.fromEnv();
const ratelimit = new Ratelimit({
	redis: redisClient,
	limiter: Ratelimit.slidingWindow(100, "10 s"),
});

// Set of allowed card types for validation
const ALLOWED_CARD_TYPES = new Set([
	"animeStats",
	"socialStats",
	"mangaStats",
	"animeGenres",
	"animeTags",
	"animeVoiceActors",
	"animeStudios",
	"animeStaff",
	"mangaGenres",
	"mangaTags",
	"mangaStaff",
]);

// Display names for card types, used in templates
const displayNames: { [key: string]: string } = {
	animeStats: "Anime Stats",
	socialStats: "Social Stats",
	mangaStats: "Manga Stats",
	animeGenres: "Anime Genres",
	animeTags: "Anime Tags",
	animeVoiceActors: "Anime Voice Actors",
	animeStudios: "Anime Studios",
	animeStaff: "Anime Staff",
	mangaGenres: "Manga Genres",
	mangaTags: "Manga Tags",
	mangaStaff: "Manga Staff",
};

// Type definitions for category keys and item types
type CategoryKey = "genres" | "tags" | "voiceactors" | "studios" | "staff";
type GenreItem = { genre: string; count: number };
type TagItem = { tag: { name: string }; count: number };
type VoiceActorItem = { voiceActor: { name: { full: string } }; count: number };
type StudioItem = { studio: { name: string }; count: number };
type StaffItem = { staff: { name: { full: string } }; count: number };

// Function to generate SVG error response
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

// Headers for successful SVG responses (with caching)
function svgHeaders() {
	return {
		"Content-Type": "image/svg+xml",
		"Cache-Control": "public, max-age=86400, stale-while-revalidate=86400", // 24 hour cache, revalidate in background
		"Access-Control-Allow-Origin": "https://anilist.co", // For cross-origin requests from AniList
		"Access-Control-Allow-Methods": "GET",
		Vary: "Origin", // Cache varies based on Origin header
	};
}

// Headers for error SVG responses (no caching)
function errorHeaders() {
	return {
		"Content-Type": "image/svg+xml",
		"Cache-Control": "no-store, max-age=0, must-revalidate", // No cache, force revalidation
		"Access-Control-Allow-Origin": "https://anilist.co", // For cross-origin requests from AniList
		"Access-Control-Allow-Methods": "GET",
		Vary: "Origin", // Header varies based on Origin
	};
}

// Function to generate SVG content based on card configuration and user stats
function generateCardSVG(
	cardConfig: CardConfig,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	userStats: any,
	variant: "default" | "vertical" | "pie"
) {
	// Basic validation: card config and user stats must be present
	if (!cardConfig || !userStats?.stats?.User?.statistics?.anime) {
		throw new Error("Missing card configuration or stats data");
	}
	let milestoneData;
	let svgContent: string;

	// Extract base card type and possible variation
	const [baseCardType] = cardConfig.cardName.split("-");
	const showPieChart = variant === "pie";

	// Switch logic to handle different card types
	switch (baseCardType) {
		// Anime Stats Card
		case "animeStats":
			// Extract episodes watched for milestone calculation
			const episodesWatched = userStats.stats.User.statistics.anime.episodesWatched;
			milestoneData = calculateMilestones(episodesWatched); // Calculate milestones based on episodes watched

			// Generate SVG content using mediaStatsTemplate for anime
			svgContent = mediaStatsTemplate({
				mediaType: "anime",
				username: userStats.username,
				variant: variant as "default" | "vertical",
				styles: {
					// Card styles from config
					titleColor: cardConfig.titleColor,
					backgroundColor: cardConfig.backgroundColor,
					textColor: cardConfig.textColor,
					circleColor: cardConfig.circleColor,
				},
				stats: {
					// Anime stats and milestones
					...userStats.stats.User.statistics.anime,
					...milestoneData,
				},
			});
			break;

		// Manga Stats Card
		case "mangaStats":
			// Extract chapters read for milestone calculation
			const chaptersRead = userStats.stats.User.statistics.manga.chaptersRead;
			milestoneData = calculateMilestones(chaptersRead); // Calculate milestones based on chapters read

			// Generate SVG content using mediaStatsTemplate for manga
			svgContent = mediaStatsTemplate({
				mediaType: "manga",
				username: userStats.username,
				variant: variant as "default" | "vertical",
				styles: {
					// Card styles from config
					titleColor: cardConfig.titleColor,
					backgroundColor: cardConfig.backgroundColor,
					textColor: cardConfig.textColor,
					circleColor: cardConfig.circleColor,
				},
				stats: {
					// Manga stats and milestones
					...userStats.stats.User.statistics.manga,
					...milestoneData,
				},
			});
			break;

		// Social Stats Card
		case "socialStats":
			// Generate SVG content using socialStatsTemplate
			svgContent = socialStatsTemplate({
				username: userStats.username,
				styles: {
					// Card styles from config
					titleColor: cardConfig.titleColor,
					backgroundColor: cardConfig.backgroundColor,
					textColor: cardConfig.textColor,
					circleColor: cardConfig.circleColor,
				},
				stats: userStats.stats, // User stats data
				activityHistory: userStats.stats.User.stats.activityHistory, // Activity history for social stats
			});
			break;

		// Category-based Cards (Genres, Tags, Voice Actors, Studios, Staff)
		case "animeGenres":
		case "animeTags":
		case "animeVoiceActors":
		case "animeStudios":
		case "animeStaff":
		case "mangaGenres":
		case "mangaTags":
		case "mangaStaff":
			// Determine if it's an anime or manga card
			const isAnime = baseCardType.startsWith("anime");
			// Map card name parts to stat category keys
			const categoryMap: Record<CategoryKey, string> = {
				genres: "genres",
				tags: "tags",
				voiceactors: "voiceActors",
				studios: "studios",
				staff: "staff",
			};
			// Extract category key from base card name
			const categoryKey =
				categoryMap[
					baseCardType
						.replace(isAnime ? "anime" : "manga", "")
						.toLowerCase() as CategoryKey
				];
			// Select anime or manga stats based on card type
			const stats = isAnime
				? userStats.stats.User.statistics.anime
				: userStats.stats.User.statistics.manga;

			// Extract top 5 items from the selected category
			const items =
				stats[categoryKey]
					?.slice(0, 5) // Get top 5 items
					.map((item: GenreItem | TagItem | VoiceActorItem | StudioItem | StaffItem) => {
						// Map item structure based on category
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
								return { name: "", count: 0 }; // Default case to avoid errors
						}
					}) || []; // Default to empty array if category stats are missing

			// Generate SVG content using extraAnimeMangaStatsTemplate for category-based cards
			svgContent = extraAnimeMangaStatsTemplate({
				username: userStats.username,
				styles: {
					// Card styles from config
					titleColor: cardConfig.titleColor,
					backgroundColor: cardConfig.backgroundColor,
					textColor: cardConfig.textColor,
					circleColor: cardConfig.circleColor,
				},
				format: displayNames[baseCardType],
				stats: items,
				showPieChart: showPieChart,
			});
			break;
		// Default case for unsupported card types
		default:
			throw new Error("Unsupported card type");
	}

	return svgContent; // Return generated SVG content
}

// Main GET handler for card SVG generation
export async function GET(request: Request) {
	const startTime = Date.now(); // Start time for performance tracking
	const ip = request.headers.get("x-forwarded-for") || "127.0.0.1"; // Get IP address for rate limiting

	// Rate limiter check
	const { success } = await ratelimit.limit(ip);
	if (!success) {
		console.warn(`🚨 [Card SVG] Rate limit exceeded for IP: ${ip}`);
		return new Response(svgError("Too many requests - try again later"), {
			headers: errorHeaders(), // Use error headers (no-cache)
			status: 200, // Still return 200 OK to display error SVG
		});
	}

	console.log(`🚀 [Card SVG] New request from IP: ${ip} - URL: ${request.url}`);

	// Extract parameters from URL search params
	const { searchParams } = new URL(request.url);
	const userId = searchParams.get("userId");
	const cardType = searchParams.get("cardType");
	const variationParam = searchParams.get("variation");
	const variant =
		variationParam === "vertical" ? "vertical" : variationParam === "pie" ? "pie" : "default";

	console.log(`🖼️ [Card SVG] Request for ${cardType} card - User ID: ${userId}`);

	// Parameter validation: userId and cardType are required
	if (!userId || !cardType) {
		const missingParam = !userId ? "userId" : "cardType";
		console.warn(`⚠️ [Card SVG] Missing parameter: ${missingParam}`);
		return new Response(svgError("Missing parameters"), {
			headers: errorHeaders(),
			status: 200, // Still return 200 OK to display error SVG
		});
	}

	// Validate userId format (must be a number)
	const numericUserId = parseInt(userId);
	if (isNaN(numericUserId)) {
		console.warn(`⚠️ [Card SVG] Invalid user ID format: ${userId}`);
		return new Response(svgError("Invalid user ID"), {
			headers: errorHeaders(),
			status: 200,
		});
	}

	// Validate cardType against allowed types
	const [baseCardType] = cardType.split("-");
	if (!ALLOWED_CARD_TYPES.has(baseCardType)) {
		console.warn(`⚠️ [Card SVG] Invalid card type: ${cardType}`);
		return new Response(svgError("Invalid card type"), {
			headers: errorHeaders(),
			status: 200,
		});
	}

	try {
		console.log(`🔍 [Card SVG] Fetching data for user ${numericUserId}`);
		const [cardsDataStr, userDataStr] = await Promise.all([
			redisClient.get(`cards:${numericUserId}`),
			redisClient.get(`user:${numericUserId}`),
		]);

		// Explicitly check if Redis returned nothing or "null"
		if (!cardsDataStr || cardsDataStr === "null" || !userDataStr || userDataStr === "null") {
			console.warn(`⚠️ [Card SVG] User ${numericUserId} data not found in Redis`);
			return new Response(svgError("User data not found"), {
				headers: errorHeaders(), // Use error headers (no-cache)
				status: 200, // Still return 200 OK to display error SVG
			});
		}

		const cardDoc: CardsRecord = safeParse<CardsRecord>(cardsDataStr);
		const userDoc: UserRecord = safeParse<UserRecord>(userDataStr);

		// Find the specific card configuration from the stored cards data
		const cardConfig = cardDoc.cards.find((c: CardConfig) => c.cardName === cardType);
		if (!cardConfig) {
			console.warn(
				`⚠️ [Card SVG] Card config for ${cardType} not found for user ${numericUserId}`
			);
			return new Response(svgError("Card config not found"), {
				headers: errorHeaders(),
				status: 200,
			});
		}

		console.log(
			`🎨 [Card SVG] Generating ${cardType} (${variant}) SVG for user ${numericUserId}`
		);
		try {
			// Generate SVG content using generateCardSVG function
			const svgContent = generateCardSVG(
				cardConfig,
				userDoc as unknown as UserStats,
				variant
			);
			const duration = Date.now() - startTime; // Calculate generation duration
			if (duration > 1500) {
				console.warn(
					`⏳ [Card SVG] Slow rendering detected: ${duration}ms for user ${numericUserId}`
				);
			}
			console.log(
				`✅ [Card SVG] Rendered ${cardType} card for ${numericUserId} in ${duration}ms`
			);
			return new Response(svgContent, {
				// Return SVG response
				headers: svgHeaders(), // Use success headers (with cache)
			});
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		} catch (error: any) {
			const duration = Date.now() - startTime;
			console.error(
				`🔥 [Card SVG] Error generating card for user ${numericUserId} after ${duration}ms:`,
				error
			);
			if (error.stack) {
				console.error(`💥 [Card SVG] Stack Trace: ${error.stack}`);
			}
			return new Response(svgError("Server Error"), {
				headers: errorHeaders(), // Use error headers (no-cache)
				status: 200, // Still return 200 OK to display error SVG
			});
		}
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} catch (error: any) {
		const duration = Date.now() - startTime;
		console.error(
			`🔥 [Card SVG] General error for user ${numericUserId} after ${duration}ms:`,
			error
		);
		if (error.stack) {
			console.error(`💥 [Card SVG] Stack Trace: ${error.stack}`);
		}
		return new Response(svgError("Server Error"), {
			headers: errorHeaders(), // Use error headers (no-cache)
			status: 200, // Still return 200 OK to display error SVG
		});
	}
}
