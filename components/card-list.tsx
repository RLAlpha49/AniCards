"use client";

import { Card } from "@/components/card";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { copyToClipboard } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check } from "lucide-react";
import { Link } from "lucide-react";

interface CardType {
	type: string;
	svgUrl: string;
	rawType: string;
}

interface CardListProps {
	cardTypes: CardType[];
}

export function CardList({ cardTypes }: CardListProps) {
	const [copied, setCopied] = useState<string | null>(null);
	const svgLinks = cardTypes.map((card) => card.svgUrl);
	const anilistBioLinks = cardTypes.map((card) => `img150(${card.svgUrl})`);

	const handleCopyLinks = async (type: "svg" | "anilist") => {
		const links = type === "svg" ? svgLinks : anilistBioLinks;

		await copyToClipboard(links.join("\n"));
		setCopied(type);
		setTimeout(() => setCopied(null), 2000);
	};

	return (
		<div className="flex flex-col items-center space-y-4">
			<Popover>
				<PopoverTrigger asChild>
					<Button variant="outline">
						<Link className="mr-2 h-4 w-4" /> Copy All Links
					</Button>
				</PopoverTrigger>
				<PopoverContent className="w-80">
					<div className="space-y-2">
						<div>
							<p className="text-sm font-medium">SVG Link</p>
							<div className="flex mt-1">
								<input
									className="flex-grow px-3 py-2 border rounded-l-md text-sm"
									value={svgLinks.join("\n")}
									readOnly
								/>
								<Button
									className="rounded-l-none"
									onClick={() => handleCopyLinks("svg")}
								>
									{copied === "svg" ? <Check className="h-4 w-4" /> : "Copy"}
								</Button>
							</div>
						</div>
						<div>
							<p className="text-sm font-medium">Anilist Bio Example</p>
							<div className="flex mt-1">
								<input
									className="flex-grow px-3 py-2 border rounded-l-md text-sm"
									value={anilistBioLinks.join("\n")}
									readOnly
								/>
								<Button
									className="rounded-l-none"
									onClick={() => handleCopyLinks("anilist")}
								>
									{copied === "anilist" ? <Check className="h-4 w-4" /> : "Copy"}
								</Button>
							</div>
						</div>
					</div>
				</PopoverContent>
			</Popover>
			<div className="flex flex-wrap justify-center gap-6">
				{cardTypes.map((card) => (
					<Card key={card.rawType} {...card} />
				))}
			</div>
		</div>
	);
}
