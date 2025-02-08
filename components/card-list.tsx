"use client";

import { Card } from "@/components/card";

interface CardType {
	type: string;
	svgUrl: string;
	rawType: string;
}

interface CardListProps {
	cardTypes: CardType[];
}

export function CardList({ cardTypes }: CardListProps) {
	return (
		<div className="flex flex-wrap justify-center gap-6">
			{cardTypes.map((card) => (
				<Card key={card.rawType} {...card} />
			))}
		</div>
	);
}
