import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { MongoServerError } from "mongodb";
import { animeStatsTemplate } from "@/lib/svg-templates/anime-stats";
import { CardConfig, UserStats } from "@/lib/types/card";
import { calculateMilestones } from "@/lib/utils/milestones";
import { mangaStatsTemplate } from "@/lib/svg-templates/manga-stats";
import { socialStatsTemplate } from "@/lib/svg-templates/social-stats";
import { extraAnimeMangaStatsTemplate } from "@/lib/svg-templates/extra-anime-manga-stats";
import { extractErrorInfo } from "@/lib/utils";
import clientPromise from "@/lib/utils/mongodb";

// Rate limiter setup using Upstash Redis
const ratelimit = new Ratelimit({
	redis: Redis.fromEnv(),
	limiter: Ratelimit.slidingWindow(15, "10 s"), // Allow 15 requests per 10 seconds
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function generateCardSVG(cardConfig: CardConfig, userStats: any) {
	// Basic validation: card config and user stats must be present
	if (!cardConfig || !userStats?.stats?.User?.statistics?.anime) {
		throw new Error("Missing card configuration or stats data");
	}
	let milestoneData;
	let svgContent: string;

	// Switch logic to handle different card types
	switch (cardConfig.cardName) {
		// Anime Stats Card
		case "animeStats":
			// Extract episodes watched for milestone calculation
			const episodesWatched = userStats.stats.User.statistics.anime.episodesWatched;
			milestoneData = calculateMilestones(episodesWatched); // Calculate milestones based on episodes watched

			// Generate SVG content using animeStatsTemplate
			svgContent = animeStatsTemplate({
				username: userStats.username,
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

			// Generate SVG content using mangaStatsTemplate
			svgContent = mangaStatsTemplate({
				username: userStats.username,
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
			const isAnime = cardConfig.cardName.startsWith("anime");
			// Map card name parts to stat category keys
			const categoryMap: Record<CategoryKey, string> = {
				genres: "genres",
				tags: "tags",
				voiceactors: "voiceActors",
				studios: "studios",
				staff: "staff",
			};
			// Extract category key from card name
			const categoryKey =
				categoryMap[
					cardConfig.cardName
						.replace(isAnime ? "anime" : "manga", "") // Remove "anime" or "manga" prefix
						.toLowerCase() as CategoryKey // Convert to lowercase and cast to CategoryKey
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
				format: displayNames[cardConfig.cardName], // Display name for the card type
				stats: items, // Top 5 items for the category
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
	const { success } = await ratelimit.limit(ip); // Apply rate limit

	// Rate limit exceeded - return error SVG
	if (!success) {
		return new Response(svgError("Too many requests - try again later"), {
			headers: errorHeaders(), // Use error headers (no-cache)
			status: 200, // Still return 200 OK to display error SVG
		});
	}

	// Extract parameters from URL search params
	const { searchParams } = new URL(request.url);
	const userId = searchParams.get("userId"); // User ID parameter
	const cardType = searchParams.get("cardType"); // Card type parameter

	console.log(`🖼️ [Card SVG] Request for ${cardType} card - User ID: ${userId}`);

	// Parameter validation: userId and cardType are required
	if (!userId || !cardType) {
		const missingParam = !userId ? "userId" : "cardType";
		console.warn(`⚠️ [Card SVG] Missing parameter: ${missingParam}`);
		return new Response(svgError("Missing parameters"), {
			headers: errorHeaders(), // Use error headers (no-cache)
			status: 200, // Still return 200 OK to display error SVG
		});
	}

	// Validate cardType against allowed types
	if (!ALLOWED_CARD_TYPES.has(cardType)) {
		console.warn(`⚠️ [Card SVG] Invalid card type: ${cardType}`);
		return new Response(svgError("Invalid card type"), {
			headers: errorHeaders(), // Use error headers (no-cache)
			status: 200, // Still return 200 OK to display error SVG
		});
	}

	// Validate userId format (must be a number)
	const numericUserId = parseInt(userId);
	if (isNaN(numericUserId)) {
		console.warn(`⚠️ [Card SVG] Invalid user ID format: ${userId}`);
		return new Response(svgError("Invalid user ID"), {
			headers: errorHeaders(), // Use error headers (no-cache)
			status: 200, // Still return 200 OK to display error SVG
		});
	}

	try {
		console.log(`🔍 [Card SVG] Fetching data for user ${numericUserId}`);
		// Initialize MongoDB client
		const client = await clientPromise;
		const db = client.db("anicards");

		// Fetch card config and user data in parallel
		const [cardDoc, userDoc] = await Promise.all([
			db.collection("cards").findOne({
				// Find card document for user and card type
				userId: numericUserId,
				"cards.cardName": cardType, // Match specific card type within cards array
			}),
			db.collection("users").findOne({
				// Find user document
				userId: numericUserId,
			}),
		]);

		// Check if card config or user data was not found
		if (!cardDoc || !userDoc) {
			console.warn(`⚠️ [Card SVG] User ${numericUserId} not found`);
			return new Response(svgError("User data not found"), {
				headers: errorHeaders(), // Use error headers (no-cache)
				status: 200, // Still return 200 OK to display error SVG
			});
		}

		// Extract specific card configuration from card document
		const cardConfig = cardDoc.cards.find((c: CardConfig) => c.cardName === cardType);

		console.log(`🎨 [Card SVG] Generating ${cardType} SVG for user ${numericUserId}`);
		try {
			// Generate SVG content using generateCardSVG function
			const svgContent = generateCardSVG(cardConfig, userDoc as unknown as UserStats);
			const duration = Date.now() - startTime; // Calculate generation duration
			console.log(
				`✅ [Card SVG] Rendered ${cardType} card for ${numericUserId} [${duration}ms]`
			);
			return new Response(svgContent, {
				// Return SVG response
				headers: svgHeaders(), // Use success headers (with cache)
			});
		} catch (error) {
			// Error during card SVG generation
			console.error("Card generation failed:", error);
			const duration = Date.now() - startTime; // Calculate error duration
			console.error(`🔥 [Card SVG] Error after ${duration}ms:`, error);
			return new Response(svgError("Server Error"), {
				// Return error SVG
				headers: errorHeaders(), // Use error headers (no-cache)
				status: 200, // Still return 200 OK to display error SVG
			});
		}
	} catch (error) {
		// MongoDB connection or query error
		if (error instanceof MongoServerError) {
			error = extractErrorInfo(error); // Extract simplified error info
		}
		console.error("Card generation failed:", error);
		const duration = Date.now() - startTime; // Calculate error duration
		console.error(`🔥 [Card SVG] Error after ${duration}ms:`, error);
		return new Response(svgError("Server Error"), {
			// Return error SVG
			headers: errorHeaders(), // Use error headers (no-cache)
			status: 200, // Still return 200 OK to display error SVG
		});
	}
}
