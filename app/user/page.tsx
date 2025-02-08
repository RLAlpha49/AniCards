import { CardList } from "@/components/card-list";
import { displayNames } from "@/components/stat-card-preview";

export const dynamic = "force-dynamic";

export default async function UserPage({
	searchParams,
}: Readonly<{ searchParams: { userId?: string } }>) {
	searchParams = await searchParams;
	if (!searchParams.userId) {
		return <div className="container mx-auto p-4">Missing user ID parameter</div>;
	}

	const userId = searchParams.userId;

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let userData: any = null;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let cards: any[] = [];

	try {
		const userRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/user?userId=${userId}`);
		if (!userRes.ok) {
			const error = await userRes.json();
			throw new Error(error.error || "Failed to fetch user");
		}
		userData = await userRes.json();

		const cardsRes = await fetch(
			`${process.env.NEXT_PUBLIC_API_URL}/api/cards?userId=${userId}`
		);
		if (!cardsRes.ok) {
			const error = await cardsRes.json();
			throw new Error(error.error || "Failed to fetch cards");
		}
		const cardsData = await cardsRes.json();
		cards = cardsData[0]?.cards || [];
	} catch (error: unknown) {
		console.error("Fetch error:", error);
		return (
			<div className="container mx-auto p-4">
				{error instanceof Error ? error.message : "Error loading data"}
			</div>
		);
	}

	const cardTypes = cards.map((card) => {
		const displayName = displayNames[card.cardName] || card.cardName;
		return {
			type: displayName,
			svgUrl: `${process.env.NEXT_PUBLIC_API_URL}/api/card.svg?cardType=${card.cardName}&userId=${userId}`,
			rawType: card.cardName,
		};
	});

	return (
		<div className="container mx-auto p-4">
			<h1 className="text-3xl font-bold mb-8 text-center">
				{userData.username}&apos;s Generated Cards
			</h1>

			{cardTypes.length > 0 ? (
				<div className="flex justify-center">
					<CardList cardTypes={cardTypes} />
				</div>
			) : (
				<div className="text-gray-500 text-center py-8">No cards found for this user</div>
			)}
		</div>
	);
}
