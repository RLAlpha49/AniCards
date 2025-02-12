// Centralized data management for user preferences
import { colorPresets, statCardTypes } from "@/components/stat-card-generator";

type UserPreferences = {
	colorPreset: string;
	defaultCards: string[];
};

const APP_PREFIX = "anicards-";
const VALID_CACHE_KEYS = [
	"statCardConfig",
	"statCardColors",
	"statCardTypes",
	"sidebarDefaultOpen",
	"defaultColorPreset",
	"defaultCardTypes",
].map((key) => `${APP_PREFIX}${key}`);

export function loadDefaultSettings(): UserPreferences {
	const loadValue = (key: string) => {
		const stored = localStorage.getItem(`${APP_PREFIX}${key}`);
		if (!stored) return null;

		try {
			const parsed = JSON.parse(stored);
			return parsed.value ?? parsed; // Handle both new and old formats
		} catch {
			return stored; // Fallback to raw string
		}
	};

	return {
		colorPreset: loadValue("defaultColorPreset") || "default",
		defaultCards: loadValue("defaultCardTypes") || [],
	};
}

export function saveDefaultPreset(preset: string) {
	const data = {
		value: preset,
		lastModified: new Date().toISOString(),
	};
	localStorage.setItem(`${APP_PREFIX}defaultColorPreset`, JSON.stringify(data));
}

export function saveDefaultCardTypes(cardTypes: string[]) {
	const data = {
		value: cardTypes,
		lastModified: new Date().toISOString(),
	};
	localStorage.setItem(`${APP_PREFIX}defaultCardTypes`, JSON.stringify(data));
}

// Helper to get actual color values from preset name
export function getPresetColors(presetName: string) {
	return (
		colorPresets[presetName as keyof typeof colorPresets]?.colors || colorPresets.default.colors
	);
}

// Helper to get card type labels for display
export function getCardTypeLabel(cardId: string) {
	return statCardTypes.find((t) => t.id === cardId)?.label || cardId;
}

export function getSiteSpecificCache() {
	return Object.keys(localStorage)
		.filter((key) => key.startsWith(APP_PREFIX))
		.map((key) => {
			const item = localStorage.getItem(key)!;
			let size = new Blob([item]).size;
			let lastModified = new Date().toISOString();

			try {
				const parsed = JSON.parse(item);
				if (parsed.lastModified) {
					lastModified = parsed.lastModified;
					size = new Blob([JSON.stringify(parsed)]).size;
				}
			} catch {}

			return {
				key: key.replace(APP_PREFIX, ""),
				size,
				lastModified,
			};
		});
}

export function clearSiteCache() {
	VALID_CACHE_KEYS.forEach((key) => localStorage.removeItem(key));
}
