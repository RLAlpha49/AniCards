"use client";

import { useState, useEffect, useMemo } from "react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LoadingOverlay } from "@/components/loading-spinner";
import { ErrorPopup } from "@/components/error-popup";
import { cn } from "@/lib/utils";
import { StatCardPreview } from "@/components/stat-card-generator/stat-card-preview";
import { mediaStatsTemplate } from "@/lib/svg-templates/media-stats";
import { ColorPresetSelector } from "@/components/stat-card-generator/color-preset-selector";
import { ColorPickerGroup } from "@/components/stat-card-generator/color-picker-group";
import { LivePreview } from "@/components/stat-card-generator/live-preview";
import { StatCardTypeSelection } from "@/components/stat-card-generator/stat-card-type-selection";
import { UpdateNotice } from "@/components/stat-card-generator/update-notice";
import { UserDetailsForm } from "@/components/stat-card-generator/user-details-form";
import { useStatCardSubmit } from "@/hooks/use-stat-card-submit";
import { loadDefaultSettings, getPresetColors } from "@/lib/data";

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
export const statCardTypes = [
	{
		id: "animeStats",
		label: "Anime Stats (Count, Episodes Watched, Minutes Watched, Mean Score, Standard Deviation)",
		variations: [
			{ id: "default", label: "Default" },
			{ id: "vertical", label: "Vertical" },
		],
	},
	{
		id: "socialStats",
		label: "Social Stats (Total Activities, Followers, Following, Thread Posts/Comments, Reviews)",
		variations: [{ id: "default", label: "Default" }],
	},
	{
		id: "mangaStats",
		label: "Manga Stats (Count, Chapters Read, Volumes Read, Mean Score, Standard Deviation)",
		variations: [
			{ id: "default", label: "Default" },
			{ id: "vertical", label: "Vertical" },
		],
	},
	{
		id: "animeGenres",
		label: "Anime Genres (Top 5 Count)",
		variations: [
			{ id: "default", label: "Default" },
			{ id: "pie", label: "Pie Chart" },
		],
	},
	{
		id: "animeTags",
		label: "Anime Tags (Top 5 Count)",
		variations: [
			{ id: "default", label: "Default" },
			{ id: "pie", label: "Pie Chart" },
		],
	},
	{
		id: "animeVoiceActors",
		label: "Anime Voice Actors (Top 5 Count)",
		variations: [{ id: "default", label: "Default" }],
	},
	{
		id: "animeStudios",
		label: "Anime Studios (Top 5 Count)",
		variations: [{ id: "default", label: "Default" }],
	},
	{
		id: "animeStaff",
		label: "Anime Staff (Top 5 Count)",
		variations: [{ id: "default", label: "Default" }],
	},
	{
		id: "mangaGenres",
		label: "Manga Genres (Top 5 Count)",
		variations: [
			{ id: "default", label: "Default" },
			{ id: "pie", label: "Pie Chart" },
		],
	},
	{
		id: "mangaTags",
		label: "Manga Tags (Top 5 Count)",
		variations: [
			{ id: "default", label: "Default" },
			{ id: "pie", label: "Pie Chart" },
		],
	},
	{
		id: "mangaStaff",
		label: "Manga Staff (Top 5 Count)",
		variations: [{ id: "default", label: "Default" }],
	},
];

export const colorPresets = {
	default: { colors: ["#fe428e", "#141321", "#a9fef7", "#fe428e"], mode: "dark" },
	anilistLight: {
		colors: ["#3cc8ff", "#FFFFFF", "#333333", "#3cc8ff"],
		mode: "light",
	},
	anilistDark: {
		colors: ["#3cc8ff", "#0b1622", "#E8E8E8", "#3cc8ff"],
		mode: "dark",
	},
	sunset: { colors: ["#ff7e5f", "#fff7ed", "#431407", "#ff7e5f"], mode: "light" },
	ocean: { colors: ["#00b4d8", "#f0f9ff", "#03045e", "#00b4d8"], mode: "light" },
	forest: { colors: ["#2d6a4f", "#f0fdf4", "#052e16", "#2d6a4f"], mode: "light" },
	lavender: { colors: ["#7c3aed", "#f5f3ff", "#1e1b4b", "#7c3aed"], mode: "light" },
	midnight: { colors: ["#8b5cf6", "#0f172a", "#e2e8f0", "#8b5cf6"], mode: "dark" },
	coral: { colors: ["#ff6b6b", "#ffe8e8", "#2d3436", "#ff6b6b"], mode: "light" },
	aurora: { colors: ["#10b981", "#042f2e", "#a7f3d0", "#10b981"], mode: "dark" },
	rosegold: { colors: ["#fb7185", "#fff1f2", "#4c0519", "#fb7185"], mode: "light" },
	galaxy: { colors: ["#818cf8", "#1e1b4b", "#c7d2fe", "#818cf8"], mode: "dark" },
	citrus: { colors: ["#f59e0b", "#431407", "#fde68a", "#f59e0b"], mode: "dark" },
	twilight: { colors: ["#c084fc", "#1e1b4b", "#e9d5ff", "#c084fc"], mode: "dark" },
	seafoam: { colors: ["#2dd4bf", "#042f2e", "#ccfbf1", "#2dd4bf"], mode: "dark" },
	monochromeGray: { colors: ["#6b7280", "#f9fafb", "#1f2937", "#9ca3af"], mode: "light" },
	darkModeBlue: { colors: ["#93c5fd", "#0f172a", "#e2e8f0", "#60a5fa"], mode: "dark" },
	earthyGreen: { colors: ["#84cc16", "#fefce8", "#374151", "#a3e635"], mode: "light" },
	purpleDusk: { colors: ["#c084fc", "#4a044a", "#f3e8ff", "#a855f7"], mode: "dark" },
	redAlert: { colors: ["#ef4444", "#000000", "#f8fafc", "#dc2626"], mode: "dark" },
	goldStandard: { colors: ["#facc15", "#111827", "#f0f0f0", "#eab308"], mode: "dark" },
	cyberpunk: { colors: ["#ff4081", "#121212", "#00ffff", "#ff80ab"], mode: "dark" },
	pastelDreams: { colors: ["#a78bfa", "#f0fdfa", "#4b5563", "#c4b5fd"], mode: "light" },
	vintageSepia: { colors: ["#a97142", "#f5e1da", "#5c4033", "#a97142"], mode: "light" },
	synthwave: { colors: ["#ff4ea1", "#2a2a72", "#f1f1f1", "#ff4ea1"], mode: "dark" },
	solarizedLight: { colors: ["#b58900", "#fdf6e3", "#657b83", "#268bd2"], mode: "light" },
	mint: { colors: ["#00b894", "#dfe6e9", "#2d3436", "#00b894"], mode: "light" },
	bubblegum: { colors: ["#ff6f91", "#ffe2e2", "#3f3f3f", "#ff6f91"], mode: "light" },
	stardust: { colors: ["#e0aaff", "#0d0d3f", "#ffffff", "#e0aaff"], mode: "dark" },
	oceanBreeze: { colors: ["#00bcd4", "#e0f7fa", "#00796b", "#00bcd4"], mode: "light" },
	fire: { colors: ["#ff4500", "#fff5f5", "#8b0000", "#ff4500"], mode: "light" },
	custom: { colors: ["", "", "", ""], mode: "custom" },
};

export function StatCardGenerator({ isOpen, onClose, className }: StatCardGeneratorProps) {
	// State management for form inputs and UI states
	const [username, setUsername] = useState("");
	const [titleColor, setTitleColor] = useState(colorPresets.default.colors[0]);
	const [backgroundColor, setBackgroundColor] = useState(colorPresets.default.colors[1]);
	const [textColor, setTextColor] = useState(colorPresets.default.colors[2]);
	const [circleColor, setCircleColor] = useState(colorPresets.default.colors[3]);
	const [selectedCards, setSelectedCards] = useState<string[]>([]);
	const [selectedCardVariants, setSelectedCardVariants] = useState<Record<string, string>>({});
	const [selectedPreset, setSelectedPreset] = useState("default");
	const [previewOpen, setPreviewOpen] = useState(false);
	const [previewType, setPreviewType] = useState("");
	const [previewVariation, setPreviewVariation] = useState("");

	// Use our custom hook for managing submission
	const { loading, error, submit, clearError } = useStatCardSubmit();

	// Load defaults on component mount
	useEffect(() => {
		const defaults = loadDefaultSettings();
		const presetColors = getPresetColors(defaults.colorPreset);

		setSelectedPreset(defaults.colorPreset);
		// Apply color preset
		[setTitleColor, setBackgroundColor, setTextColor, setCircleColor].forEach((setter, index) =>
			setter(presetColors[index])
		);

		// Normalize default cards:
		const uniqueCards = new Set<string>();
		const defaultVariants: Record<string, string> = {};
		defaults.defaultCards.forEach((cardId) => {
			const [base, variant] = cardId.split("-");
			uniqueCards.add(base);
			// Use a non-"default" variant if present (or simply use what's provided)
			defaultVariants[base] = variant || "default";
		});
		setSelectedCards(Array.from(uniqueCards));
		setSelectedCardVariants(defaultVariants);

		// Load default username from local storage
		const savedUsernameData = localStorage.getItem("anicards-defaultUsername");
		const defaultUsername = savedUsernameData ? JSON.parse(savedUsernameData).value : "";
		setUsername(defaultUsername);
	}, []);

	const allSelected = useMemo(
		() => statCardTypes.every((type) => selectedCards.includes(type.id)),
		[selectedCards]
	);

	// Static preview data
	const previewData = {
		mediaType: "anime" as const,
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
	const previewSVG = mediaStatsTemplate(previewData);

	const handleToggleCard = (id: string) => {
		if (selectedCards.includes(id)) {
			// Remove the card from the selection and also remove any associated variant.
			setSelectedCards(selectedCards.filter((item) => item !== id));
			setSelectedCardVariants((prev) => {
				const newObj = { ...prev };
				delete newObj[id];
				return newObj;
			});
		} else {
			setSelectedCards([...selectedCards, id]);
		}
	};

	// Handle changes in the variant for a card type that supports variants.
	const handleVariantChange = (cardType: string, variant: string) => {
		setSelectedCardVariants((old) => ({
			...old,
			[cardType]: variant,
		}));
	};

	const handleSelectAll = () => {
		// Select all card types (base ids)
		const allIds = statCardTypes.map((type) => type.id);
		setSelectedCards(allIds);
		// For cards with variants, default to "default" if not already set.
		setSelectedCardVariants((old) => {
			const newObj = { ...old };
			statCardTypes.forEach((type) => {
				if (type.variations) {
					if (!newObj[type.id]) newObj[type.id] = "default";
				}
			});
			return newObj;
		});
	};

	// Preview expects the base card id and its currently selected variant.
	const handlePreview = (cardType: string, variant: string) => {
		setPreviewType(cardType);
		setPreviewVariation(variant || "default");
		setPreviewOpen(true);
	};

	// When submitting, we reassemble the selectedCards array. For card types with variants,
	// we append the variant suffix only if it is not "default". (If it is "default", we leave it off.)
	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		const finalSelectedCards = selectedCards.map((card) => {
			const type = statCardTypes.find((t) => t.id === card);
			if (type?.variations) {
				const variant = selectedCardVariants[card] || "default";
				return variant !== "default" ? `${card}-${variant}` : card;
			}
			return card;
		});
		await submit({
			username,
			selectedCards: finalSelectedCards,
			colors: [titleColor, backgroundColor, textColor, circleColor],
		});
	};

	// Prepare configuration for the color pickers
	const colorPickers = [
		{
			id: "titleColor",
			label: "Title",
			value: titleColor,
			onChange: (value: string) => {
				setTitleColor(value);
				setSelectedPreset("custom");
			},
		},
		{
			id: "backgroundColor",
			label: "Background",
			value: backgroundColor,
			onChange: (value: string) => {
				setBackgroundColor(value);
				setSelectedPreset("custom");
			},
		},
		{
			id: "textColor",
			label: "Text",
			value: textColor,
			onChange: (value: string) => {
				setTextColor(value);
				setSelectedPreset("custom");
			},
		},
		{
			id: "circleColor",
			label: "Circle",
			value: circleColor,
			onChange: (value: string) => {
				setCircleColor(value);
				setSelectedPreset("custom");
			},
		},
	];

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			{loading && <LoadingOverlay text="Creating your stat cards..." />}
			<DialogContent
				className={cn(
					"sm:max-w-[600px] overflow-y-auto max-h-[calc(100vh-9rem)] z-50",
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
					{/* User Details */}
					<UserDetailsForm username={username} onUsernameChange={setUsername} />

					{/* Color Preset Selector */}
					<ColorPresetSelector
						selectedPreset={selectedPreset}
						presets={colorPresets}
						onPresetChange={(preset) => {
							setSelectedPreset(preset);
							if (preset !== "custom") {
								[
									setTitleColor,
									setBackgroundColor,
									setTextColor,
									setCircleColor,
								].forEach((setter, index) =>
									setter(
										colorPresets[preset as keyof typeof colorPresets].colors[
											index
										]
									)
								);
							}
						}}
					/>

					{/* Color Picker Grid */}
					<ColorPickerGroup pickers={colorPickers} />

					{/* Live Preview */}
					<LivePreview previewSVG={previewSVG} />

					{/* Stat Card Selection Grid */}
					<StatCardTypeSelection
						cardTypes={statCardTypes}
						selectedCards={selectedCards}
						selectedCardVariants={selectedCardVariants}
						allSelected={allSelected}
						onToggle={handleToggleCard}
						onSelectAll={handleSelectAll}
						onVariantChange={handleVariantChange}
						onPreview={handlePreview}
					/>

					{/* Form Submission */}
					<Button
						type="submit"
						className="w-full transition-transform duration-200 hover:scale-[1.02] transform-gpu"
					>
						Generate Stat Cards
					</Button>

					{/* Update Notice */}
					<UpdateNotice />
				</form>
			</DialogContent>

			<ErrorPopup
				isOpen={!!error}
				onClose={clearError}
				title="Submission Error"
				description={error?.message || "An error occurred."}
			/>
			<StatCardPreview
				isOpen={previewOpen}
				onClose={() => setPreviewOpen(false)}
				cardType={previewType}
				variation={previewVariation}
			/>
		</Dialog>
	);
}
