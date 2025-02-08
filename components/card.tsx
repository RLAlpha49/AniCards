import { useState } from "react";
import Image from "next/image";
import { Download, Link, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { svgToPng, copyToClipboard } from "@/lib/utils";

interface CardProps {
	type: string;
	svgUrl: string;
}

export function Card({ type, svgUrl }: CardProps) {
	const [copied, setCopied] = useState<string | null>(null);

	const handleDownload = async () => {
		const pngUrl = await svgToPng(svgUrl);
		const link = document.createElement("a");
		link.href = pngUrl;
		link.download = `${type}.png`;
		link.click();
	};

	const handleCopy = async (text: string, label: string) => {
		await copyToClipboard(text);
		setCopied(label);
		setTimeout(() => setCopied(null), 2000);
	};

	const svgLink = svgUrl;
	const anilistBioLink = `img150("${svgUrl}")`;

	return (
		<div className="border rounded-lg p-4 space-y-4">
			<h3 className="text-lg font-semibold">{type}</h3>
			<div className="relative aspect-video">
				<Image
					src={svgUrl || "/placeholder.svg"}
					alt={type}
					layout="fill"
					objectFit="contain"
				/>
			</div>
			<div className="flex space-x-2">
				<Button onClick={handleDownload}>
					<Download className="mr-2 h-4 w-4" /> Download PNG
				</Button>
				<Popover>
					<PopoverTrigger asChild>
						<Button variant="outline">
							<Link className="mr-2 h-4 w-4" /> Copy Link
						</Button>
					</PopoverTrigger>
					<PopoverContent className="w-80">
						<div className="space-y-2">
							<div>
								<p className="text-sm font-medium">SVG Link</p>
								<div className="flex mt-1">
									<input
										className="flex-grow px-3 py-2 border rounded-l-md text-sm"
										value={svgLink}
										readOnly
									/>
									<Button
										className="rounded-l-none"
										onClick={() => handleCopy(svgLink, "svg")}
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
										value={anilistBioLink}
										readOnly
									/>
									<Button
										className="rounded-l-none"
										onClick={() => handleCopy(anilistBioLink, "anilist")}
									>
										{copied === "anilist" ? (
											<Check className="h-4 w-4" />
										) : (
											"Copy"
										)}
									</Button>
								</div>
							</div>
						</div>
					</PopoverContent>
				</Popover>
			</div>
		</div>
	);
}
