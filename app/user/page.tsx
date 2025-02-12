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

	// Initialize variables to store user data and cards
	let userData = null;
	let cards = [];

	try {
		// Check if username and cards are pre-loaded in search params
		if (params.username && params.cards) {
			// Use pre-loaded data to avoid extra API calls
			userData = {
				userId: params.userId,
				username: params.username,
			};

			// Parse the JSON string of cards from search params
			cards = JSON.parse(params.cards).map((cardName: string) => ({
				cardName,
			}));
		} else if (params.userId) {
			// If no pre-loaded data, fetch user and card data from APIs
			const [userRes, cardsRes] = await Promise.all([
				fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/user?userId=${params.userId}`),
				fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/cards?userId=${params.userId}`),
			]);

			// Parse JSON responses from API calls
			userData = await userRes.json();
			const cardsData = await cardsRes.json();
			// Extract card list from the cardsData, default to empty array if not found
			cards = cardsData[0]?.cards || [];
		}
	} catch (error) {
		// Handle errors during data loading (either parsing or API calls)
		console.error("Data loading error:", error);
		return <div className="container mx-auto p-4">Error loading data</div>;
	}

	// Transform card data into format suitable for CardList component
	const cardTypes = cards.map((card: { cardName: string }) => {
		// Get display name for card type, fallback to cardName if not found in displayNames
		const displayName = displayNames[card.cardName] || card.cardName;
		return {
			type: displayName, // User-friendly display name for the card
			svgUrl: `${process.env.NEXT_PUBLIC_API_URL}/api/card.svg?cardType=${card.cardName}&userId=${params.userId}`, // URL to fetch SVG for the card
			rawType: card.cardName, // Raw card name for internal use
		};
	});

	return (
		<div className="container mx-auto p-4">
			<h1 className="text-3xl font-bold mb-4 text-center">
				{/* Display username in heading if available, otherwise generic text */}
				{userData?.username
					? `${userData.username}'s Generated Cards`
					: "User's Generated Cards"}
			</h1>

			{/* Display cache notice and credit request if cards are present */}
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
								href="https://x.com/Alpha49"
								target="_blank"
								rel="noopener noreferrer"
								className="text-green-600 hover:underline"
							>
								@Alpha49
							</a>{" "}
							or the{" "}
							<a
								href={`${process.env.NEXT_PUBLIC_API_URL}`}
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

			{/* Conditionally render card list or "no cards found" message */}
			{cardTypes.length > 0 ? (
				<div className="flex flex-col items-center gap-6">
					{/* Conditionally render "View All Cards" button if cards are pre-loaded and less than 11 */}
					{params.cards && cardTypes.length < 11 && (
						<div className="flex gap-4">
							<Link
								href={{
									pathname: "/user",
									query: {
										userId: params.userId,
										username: params.username,
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
						{/* Render the CardList component to display the cards */}
						<CardList cardTypes={cardTypes} />
					</div>
				</div>
			) : (
				<div className="text-gray-500 text-center py-8">No cards found for this user</div>
			)}
		</div>
	);
}
