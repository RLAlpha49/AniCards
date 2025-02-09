import { redirect } from "next/navigation";
import { CardList } from "@/components/card-list";
import { displayNames } from "@/components/stat-card-preview";
import Link from "next/link";
import { Button } from "@/components/ui/button";

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
			<h1 className="text-3xl font-bold mb-8 text-center">
				{userData?.username
					? `${userData.username}'s Generated Cards`
					: "User's Generated Cards"}
			</h1>

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
