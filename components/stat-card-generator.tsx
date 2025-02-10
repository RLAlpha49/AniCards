"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { USER_ID_QUERY, USER_STATS_QUERY } from "@/lib/anilist/queries";
import { StatCardPreview } from "@/components/stat-card-preview";
import { cn } from "@/lib/utils";
import { LoadingOverlay } from "@/components/loading-spinner";
import { ErrorPopup } from "@/components/error-popup";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";
import { animeStatsTemplate } from "@/lib/svg-templates/anime-stats";

interface StatCardGeneratorProps {
	isOpen: boolean;
	onClose: () => void;
	className?: string;
}

/*
 * Configuration objects:
 * - statCardTypes: List of stat card types with their labels and IDs
 * - colorPresets: List of color presets with their labels and colors
 */
const statCardTypes = [
	{
		id: "animeStats",

		label: "Anime Stats (Count, Episodes Watched, Minutes Watched, Mean Score, Standard Deviation)",
	},
	{
		id: "socialStats",
		label: "Social Stats (Total Activities, Followers, Following, Thread Posts/Comments, Reviews)",
	},
	{
		id: "mangaStats",
		label: "Manga Stats (Count, Chapters Read, Volumes Read, Mean Score, Standard Deviation)",
	},
	{ id: "animeGenres", label: "Anime Genres (Top 5 Count)" },
	{ id: "animeTags", label: "Anime Tags (Top 5 Count)" },
	{ id: "animeVoiceActors", label: "Anime Voice Actors (Top 5 Count)" },
	{ id: "animeStudios", label: "Anime Studios (Top 5 Count)" },
	{ id: "animeStaff", label: "Anime Staff (Top 5 Count)" },
	{ id: "mangaGenres", label: "Manga Genres (Top 5 Count)" },
	{ id: "mangaTags", label: "Manga Tags (Top 5 Count)" },
	{ id: "mangaStaff", label: "Manga Staff (Top 5 Count)" },
];

const colorPresets = {
	default: ["#fe428e", "#141321", "#a9fef7", "#fe428e"],
	sunset: ["#ff7e5f", "#feb47b", "#ffffff", "#ff7e5f"],
	ocean: ["#00b4d8", "#03045e", "#caf0f8", "#00b4d8"],
	forest: ["#2d6a4f", "#081c15", "#d8f3dc", "#2d6a4f"],
	lavender: ["#7c3aed", "#ede9fe", "#1e1b4b", "#7c3aed"],
	custom: ["", "", "", ""],
};

// Main component for generating customizable AniList stat cards
export function StatCardGenerator({ isOpen, onClose, className }: StatCardGeneratorProps) {
	// State management for form inputs and UI states
	const [username, setUsername] = useState("");
	const [titleColor, setTitleColor] = useState(colorPresets.default[0]);
	const [backgroundColor, setBackgroundColor] = useState(colorPresets.default[1]);
	const [textColor, setTextColor] = useState(colorPresets.default[2]);
	const [circleColor, setCircleColor] = useState(colorPresets.default[3]);
	const [selectedCards, setSelectedCards] = useState<string[]>([]);
	const [selectedPreset, setSelectedPreset] = useState("default");
	const [allSelected, setAllSelected] = useState(false);
	const [previewOpen, setPreviewOpen] = useState(false);
	const [previewType, setPreviewType] = useState("");
	const [loading, setLoading] = useState(false);
	const [isErrorOpen, setIsErrorOpen] = useState(false);
	const [errorTitle, setErrorTitle] = useState("");
	const [errorDescription, setErrorDescription] = useState("");
	const router = useRouter();

	// Static preview data
	const previewData = {
		username: "PreviewUser",
		styles: {
			titleColor,
			backgroundColor,
			textColor,
			circleColor,
		},
		stats: {
			count: 456,
			episodesWatched: 1234,
			minutesWatched: 45678,
			meanScore: 85.6,
			standardDeviation: 12.3,
			previousMilestone: 1000,
			currentMilestone: 1500,
			dasharray: "251.2",
			dashoffset: "175.84",
		},
	};

	// Generate preview SVG
	const previewSVG = animeStatsTemplate(previewData);

	const handleCheckboxChange = (id: string) => {
		setSelectedCards((prev) => {
			const newSelection = prev.includes(id)
				? prev.filter((item) => item !== id)
				: [...prev, id];
			setAllSelected(newSelection.length === statCardTypes.length);
			return newSelection;
		});
	};

	const handlePresetChange = (preset: string) => {
		setSelectedPreset(preset);
		// Apply preset colors unless custom is selected
		if (preset !== "custom") {
			[setTitleColor, setBackgroundColor, setTextColor, setCircleColor].forEach(
				(setter, index) => setter(colorPresets[preset as keyof typeof colorPresets][index])
			);
		}
	};

	const handleSelectAll = () => {
		if (allSelected) {
			setSelectedCards([]);
		} else {
			setSelectedCards(statCardTypes.map((type) => type.id));
		}
		setAllSelected(!allSelected);
	};

	const handlePreview = (id: string) => {
		setPreviewType(id);
		setPreviewOpen(true);
	};

	const handleError = (error: unknown) => {
		console.error("Submission failed:", error);
		setIsErrorOpen(true);
		setErrorTitle("Generation Failed");
		setErrorDescription(
			error instanceof Error ? error.message : "Failed to save card. Please try again."
		);
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);

		try {
			// Validation checks
			if (!username.trim()) throw new Error("Please enter your AniList username");
			if (selectedCards.length === 0) throw new Error("Please select at least one stat card");

			const colors = [titleColor, backgroundColor, textColor, circleColor];
			if (colors.some((color) => !color)) {
				throw new Error("All color fields must be filled");
			}

			if (selectedCards.length === 0) {
				throw new Error("Please select at least one stat card");
			}

			// Fetch AniList user data
			const userIdResponse = await fetch("/api/anilist", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					query: USER_ID_QUERY,
					variables: { userName: username },
				}),
			});

			// Error handling for API responses
			if (!userIdResponse.ok) {
				const errorData = await userIdResponse.json();
				throw new Error(errorData.error || `HTTP error! status: ${userIdResponse.status}`);
			}

			const userIdData = await userIdResponse.json();

			const statsResponse = await fetch("/api/anilist", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					query: USER_STATS_QUERY,
					variables: { userId: userIdData.User.id },
				}),
			});

			// Handle API errors for stats response
			if (!statsResponse.ok) {
				const errorData = await statsResponse.json();
				throw new Error(errorData.error || `HTTP error! status: ${statsResponse.status}`);
			}

			const statsData = await statsResponse.json();

			// Store user data and card preferences
			const [userResponse, cardResponse] = await Promise.all([
				fetch("/api/store-users", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${process.env.API_AUTH_TOKEN}`,
					},
					body: JSON.stringify({
						userId: userIdData.User.id,
						username,
						stats: statsData,
					}),
				}),
				fetch("/api/store-cards", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${process.env.API_AUTH_TOKEN}`,
					},
					body: JSON.stringify({
						userId: userIdData.User.id,
						cards: selectedCards.map((cardName) => ({
							cardName,
							titleColor,
							backgroundColor,
							textColor,
							circleColor,
						})),
					}),
				}),
			]);

			if (!userResponse.ok || !cardResponse.ok) {
				throw new Error("Failed to store data");
			}

			// Redirect to user page with generated cards
			router.push(
				`/user?${new URLSearchParams({
					userId: userIdData.User.id,
					username: username,
					cards: JSON.stringify(selectedCards),
				})}`
			);
		} catch (error) {
			// Specialized error handling for common API issues
			if (error instanceof Error) {
				if (error.message.includes("Rate limited")) {
					setErrorTitle("Rate Limited");
					setErrorDescription("AniList API is rate limited. Please try again later.");
				}
				// Handle server errors
				else if (error.message.includes("Internal server error")) {
					setErrorTitle("Server Error");
					setErrorDescription(
						"AniList API is experiencing issues. Please try again later."
					);
				} else if (error.message.includes("User not found")) {
					setErrorTitle("User Not Found");
					setErrorDescription(`No AniList user found with username: ${username}`);
				} else {
					switch (error.message) {
						case "Please enter your AniList username":
							setErrorTitle("Username Required");
							setErrorDescription(error.message);
							break;
						case "All color fields must be filled":
							setErrorTitle("Color Selection Required");
							setErrorDescription(error.message);
							break;
						case "Please select at least one stat card":
							setErrorTitle("No Cards Selected");
							setErrorDescription(error.message);
							break;
						default:
							// Show raw error message for other API errors
							setErrorTitle("API Error");
							setErrorDescription(error.message);
					}
				}
				setIsErrorOpen(true);
			} else {
				handleError(error);
			}
		} finally {
			setLoading(false);
		}
	};

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			{/* Loading overlay during API calls */}
			{loading && <LoadingOverlay text="Creating your stat cards..." />}

			<DialogContent
				className={cn(
					"sm:max-w-[600px] overflow-y-auto max-h-[calc(100vh-2rem)] z-50",
					className
				)}
			>
				<DialogHeader>
					<DialogTitle>Generate Your Stat Cards</DialogTitle>
					<DialogDescription>
						Enter your details and select the stat cards you want to generate.
					</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit} className="space-y-4">
					{/* Username input section */}
					<div>
						<Label htmlFor="username">Username</Label>
						<Input
							id="username"
							value={username}
							onChange={(e) => setUsername(e.target.value)}
							placeholder="Your Anilist username"
						/>
					</div>

					{/* Color preset selector */}
					<div>
						<Label htmlFor="colorPreset">Color Preset</Label>
						<Select onValueChange={handlePresetChange} value={selectedPreset}>
							<SelectTrigger>
								<SelectValue placeholder="Select a color preset" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="default">Default</SelectItem>
								<SelectItem value="sunset">Sunset</SelectItem>
								<SelectItem value="ocean">Ocean</SelectItem>
								<SelectItem value="forest">Forest</SelectItem>
								<SelectItem value="lavender">Lavender</SelectItem>
								<SelectItem value="custom">Custom</SelectItem>
							</SelectContent>
						</Select>
					</div>

					{/* Color picker grid */}
					<div className="grid grid-cols-2 gap-4">
						{[titleColor, backgroundColor, textColor, circleColor].map(
							(color, index) => (
								<div key={index} className="space-y-2">
									<Label
										htmlFor={
											[
												"titleColor",
												"backgroundColor",
												"textColor",
												"circleColor",
											][index]
										}
									>
										{["Title", "Background", "Text", "Circle"][index]} Color
									</Label>
									<div className="flex items-center space-x-2">
										<Input
											id={
												[
													"titleColor",
													"backgroundColor",
													"textColor",
													"circleColor",
												][index]
											}
											type="color"
											value={color}
											onChange={(e) => {
												[
													setTitleColor,
													setBackgroundColor,
													setTextColor,
													setCircleColor,
												][index](e.target.value);
												setSelectedPreset("custom");
											}}
											className="w-12 h-12 p-1 rounded transition-transform duration-200 hover:scale-105 transform-gpu cursor-pointer"
										/>
										<Input
											type="text"
											value={color}
											onChange={(e) => {
												[
													setTitleColor,
													setBackgroundColor,
													setTextColor,
													setCircleColor,
												][index](e.target.value);
												setSelectedPreset("custom");
											}}
											className="flex-grow transition-all duration-200 focus:ring-2 focus:ring-primary"
										/>
									</div>
								</div>
							)
						)}
					</div>

					{/* Live preview section */}
					<div className="space-y-2">
						<Label>Live Preview</Label>
						<div className="p-4 rounded-lg border backdrop-blur-sm flex justify-center">
							<div dangerouslySetInnerHTML={{ __html: previewSVG }} />
						</div>
						<p className="text-xs text-muted-foreground">
							Preview updates automatically with color changes
						</p>
					</div>

					{/* Card selection grid with animations */}
					<div className="space-y-4">
						<div className="flex justify-between items-center">
							<Label className="text-lg font-semibold">
								Select Stat Cards to Generate
							</Label>
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={handleSelectAll}
							>
								{allSelected ? "Unselect All" : "Select All"}
							</Button>
						</div>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							{statCardTypes.map((type, index) => (
								<div
									key={type.id}
									className={cn(
										"flex items-start space-x-2 bg-secondary/50 rounded-lg p-3",
										"transition-all duration-300 hover:bg-secondary hover:shadow-lg",
										"hover:-translate-y-1 cursor-pointer group",
										"animate-in fade-in-up fill-mode-backwards",
										selectedCards.includes(type.id) ? "ring-2 ring-primary" : ""
									)}
									style={{ animationDelay: `${index * 50}ms` }}
								>
									{/* Checkbox and card details */}
									<Checkbox
										id={type.id}
										checked={selectedCards.includes(type.id)}
										onCheckedChange={() => handleCheckboxChange(type.id)}
										className="mt-1 transition-all duration-200 scale-90 group-hover:scale-100 checked:scale-110 focus:ring-2 focus:ring-primary"
									/>
									<div className="space-y-1 flex-grow">
										<Label
											htmlFor={type.id}
											className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
										>
											{type.label.split(" (")[0]}
										</Label>
										{type.label.includes("(") && (
											<p className="text-xs text-muted-foreground transition-opacity duration-200 group-hover:opacity-100">
												{type.label.match(/\((.*)\)/)?.[1]}
											</p>
										)}
									</div>
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={() => handlePreview(type.id)}
										className="transition-all duration-200 hover:bg-primary hover:text-primary-foreground scale-90 group-hover:scale-100"
										title={`Preview ${type.label.split(" (")[0]} card`}
									>
										Preview
									</Button>
								</div>
							))}
						</div>
					</div>

					{/* Form submission and cache notice */}
					<Button
						type="submit"
						className="w-full transition-transform duration-200 hover:scale-[1.02] transform-gpu"
					>
						Generate Stat Cards
					</Button>
					<Alert className="border-blue-500 bg-blue-500/10">
						<Info className="h-5 w-5 text-blue-500" />
						<div className="ml-3">
							<AlertTitle className="text-blue-500 text-lg">Update Notice</AlertTitle>
							<AlertDescription className="text-foreground">
								{/* Cache information for users */}
								<div className="space-y-2">
									<p>
										SVGs are cached for 24 hours. If your changes don&apos;t
										appear:
									</p>
									<ul className="list-disc pl-6">
										<li>
											Hard refresh with <kbd>Ctrl</kbd>+<kbd>F5</kbd>{" "}
											(Windows) or <kbd>Cmd</kbd>+<kbd>Shift</kbd>+
											<kbd>R</kbd> (Mac)
										</li>
										<li>Clear browser cache</li>
										<li>Wait up to 24 hours for cache expiration</li>
									</ul>
								</div>
							</AlertDescription>
						</div>
					</Alert>
				</form>
			</DialogContent>

			{/* Error and preview modals */}
			<ErrorPopup
				isOpen={isErrorOpen}
				onClose={() => setIsErrorOpen(false)}
				title={errorTitle}
				description={errorDescription}
			/>
			<StatCardPreview
				isOpen={previewOpen}
				onClose={() => setPreviewOpen(false)}
				cardType={previewType}
			/>
		</Dialog>
	);
}
