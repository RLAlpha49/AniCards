import { CardList } from "@/components/user/card-list";
import { displayNames } from "@/components/stat-card-generator/stat-card-preview";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";

// Force dynamic rendering to ensure fresh data on each request
export const dynamic = "force-dynamic";

// UserPage component to display generated cards for a user
export default async function UserPage(props: {
	searchParams: Promise<{
		userId?: string;
		username?: string;
		cards?: string;
	}>;
}) {
	// Await the search parameters passed to the page
	const params = await props.searchParams;

	let userData: { userId: string; username?: string } | null = null;
	let cards: Array<{ cardName: string; variation?: string }> = [];
	let resolvedUserId = "";

	try {
		/*
		Logic:
			- If cards are preloaded (via params.cards) and either a userId or username is provided:
				• If userId is available, use it.
				• Otherwise, fetch the user data using the supplied username.
			- If only userId is provided (with no preloaded cards), use it to fetch user data and cards.
			- If only username is provided, first fetch the user data (which returns a userId)
			then fetch the cards using that userId.
		*/
		if (params.cards && (params.userId || params.username)) {
			if (params.userId) {
				resolvedUserId = params.userId;
				userData = {
					userId: params.userId,
					username: params.username,
				};
			} else if (params.username) {
				const userRes = await fetch(
					`${process.env.NEXT_PUBLIC_API_URL}/api/user?username=${params.username}`
				);
				userData = await userRes.json();
				resolvedUserId = userData?.userId as string;
			}
			// Pre-loaded cards; assume cards is a JSON encoded string.
			cards = JSON.parse(params.cards).map(
				(card: { cardName: string; variation?: string }) => ({
					cardName: card.cardName,
					variation: card.variation || "default",
				})
			);
		} else if (params.userId) {
			// If userId is present (and no preloaded cards), use it to fetch data.
			resolvedUserId = params.userId;
			const [userRes, cardsRes] = await Promise.all([
				fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/user?userId=${params.userId}`),
				fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/cards?userId=${params.userId}`),
			]);
			userData = await userRes.json();
			const cardsData = await cardsRes.json();
			cards = cardsData.cards || [];
		} else if (params.username) {
			// Only username is provided. Fetch the user data first to get the userId.
			const userRes = await fetch(
				`${process.env.NEXT_PUBLIC_API_URL}/api/user?username=${params.username}`
			);
			userData = await userRes.json();
			resolvedUserId = userData?.userId as string;
			const cardsRes = await fetch(
				`${process.env.NEXT_PUBLIC_API_URL}/api/cards?userId=${resolvedUserId}`
			);
			const cardsData = await cardsRes.json();
			cards = cardsData.cards || [];
		}
	} catch (error) {
		console.error("Data loading error:", error);
		return <div className="container mx-auto p-4">Error loading data</div>;
	}

	// Transform card data into format suitable for CardList component
	const cardTypes = cards.map((card: { cardName: string; variation?: string }) => {
		const variation = card.variation || "default";
		// Get display name for card type (fallback to cardName if not found)
		const displayName = displayNames[card.cardName] || card.cardName;
		return {
			type: displayName, // Display name for the card
			// URL to fetch SVG for the card; uses resolvedUserId and ensures the variation query string is correctly added
			svgUrl: `${process.env.NEXT_PUBLIC_API_URL}/api/card.svg?cardType=${card.cardName}&userId=${resolvedUserId}&variation=${variation}`,
			rawType: card.cardName, // Raw card name for internal use
		};
	});

	return (
		<div className="container mx-auto p-4">
			<h1 className="text-3xl font-bold mb-4 text-center">
				{userData?.username
					? `${userData.username}'s Generated Cards`
					: "User's Generated Cards"}
			</h1>

			{cardTypes.length > 0 && (
				<>
					<Alert className="mb-6 max-w-xl mx-auto border-blue-500">
						<Info className="h-4 w-4 text-blue-500" />
						<AlertTitle className="text-blue-500">Cache Notice</AlertTitle>
						<AlertDescription className="text-foreground">
							SVGs are cached for 24 hours. If updates aren&apos;t visible, try:
							<ul className="list-disc pl-6 mt-2">
								<li>
									Hard refresh (<kbd>Ctrl</kbd>+<kbd>F5</kbd> or <kbd>Cmd</kbd>+
									<kbd>Shift</kbd>+<kbd>R</kbd>)
								</li>
								<li>Clearing browser cache</li>
								<li>Waiting up to 24 hours</li>
							</ul>
						</AlertDescription>
					</Alert>

					<Alert className="mb-6 max-w-xl mx-auto border-green-500">
						<Info className="h-4 w-4 text-green-500" />
						<AlertTitle className="text-green-500">Spread the Word</AlertTitle>
						<AlertDescription className="text-foreground">
							If you found this tool useful, please consider crediting in your bio
							with{" "}
							<a
								href="https://anilist.co/user/Alpha49"
								target="_blank"
								rel="noopener noreferrer"
								className="text-green-600 hover:underline"
							>
								@Alpha49
							</a>{" "}
							or the{" "}
							<a
								href={process.env.NEXT_PUBLIC_API_URL}
								target="_blank"
								rel="noopener noreferrer"
								className="text-green-600 hover:underline"
							>
								website
							</a>
							.
						</AlertDescription>
					</Alert>
				</>
			)}

			{cardTypes.length > 0 ? (
				<div className="flex flex-col items-center gap-6">
					{params.cards && cardTypes.length < 11 && (
						<div className="flex gap-4">
							<Link
								href={{
									pathname: "/user",
									query: {
										userId: resolvedUserId,
										username: userData?.username,
									},
								}}
							>
								<Button
									variant="outline"
									className="transition-transform duration-200 hover:scale-105"
								>
									View All Generated Cards
								</Button>
							</Link>
						</div>
					)}
					<div className="flex justify-center">
						<CardList cardTypes={cardTypes} />
					</div>
				</div>
			) : (
				<div className="text-gray-500 text-center py-8">No cards found for this user</div>
			)}
		</div>
	);
}
