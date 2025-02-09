import { redirect } from "next/navigation";
import { CardList } from "@/components/card-list";
import { displayNames } from "@/components/stat-card-preview";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function UserPage(props: {
	searchParams: Promise<{
		userId?: string;
		username?: string;
		cards?: string;
	}>;
}) {
	const params = await props.searchParams;

	// Redirect to lookup if no userId
	if (!params.userId) {
		redirect("/user/lookup");
	}

	// Parse pre-loaded data if available
	let userData = null;
	let cards = [];

	try {
		if (params.username && params.cards) {
			userData = {
				userId: params.userId,
				username: params.username,
			};

			cards = JSON.parse(params.cards).map((cardName: string) => ({
				cardName,
			}));
		} else if (params.userId) {
			// Fallback to API calls if no pre-loaded data
			const [userRes, cardsRes] = await Promise.all([
				fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/user?userId=${params.userId}`),
				fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/cards?userId=${params.userId}`),
			]);

			userData = await userRes.json();
			const cardsData = await cardsRes.json();
			cards = cardsData[0]?.cards || [];
		}
	} catch (error) {
		console.error("Data loading error:", error);
		return <div className="container mx-auto p-4">Error loading data</div>;
	}

	const cardTypes = cards.map((card: { cardName: string }) => {
		const displayName = displayNames[card.cardName] || card.cardName;
		return {
			type: displayName,
			svgUrl: `${process.env.NEXT_PUBLIC_API_URL}/api/card.svg?cardType=${card.cardName}&userId=${params.userId}`,
			rawType: card.cardName,
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
				<Alert className="mb-6 max-w-2xl mx-auto border-blue-500">
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
			)}

			{cardTypes.length > 0 ? (
				<div className="flex flex-col items-center gap-6">
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
						<CardList cardTypes={cardTypes} />
					</div>
				</div>
			) : (
				<div className="text-gray-500 text-center py-8">No cards found for this user</div>
			)}
		</div>
	);
}
