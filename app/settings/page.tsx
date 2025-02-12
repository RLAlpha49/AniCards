"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useSidebar } from "@/components/ui/sidebar";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { colorPresets, statCardTypes } from "@/components/stat-card-generator";
import { getSiteSpecificCache, clearSiteCache } from "@/lib/data";
import { formatBytes } from "@/lib/utils";

export default function SettingsPage() {
	const { setTheme, theme, themes } = useTheme();
	const { open, setOpen } = useSidebar();
	const [mounted, setMounted] = useState(false);
	const [sidebarDefault, setSidebarDefault] = useState(open);
	const [cachedItems, setCachedItems] = useState<ReturnType<typeof getSiteSpecificCache>>([]);
	const [defaultPreset, setDefaultPreset] = useState("default");
	const [defaultCardTypes, setDefaultCardTypes] = useState<string[]>([]);
	const [cacheVersion, setCacheVersion] = useState(0);

	// Listen for local storage changes from other tabs
	useEffect(() => {
		const handleStorageChange = (e: StorageEvent) => {
			if (e.key?.startsWith("anicards-")) {
				setCacheVersion((v) => v + 1);
			}
		};

		window.addEventListener("storage", handleStorageChange);
		return () => window.removeEventListener("storage", handleStorageChange);
	}, []);

	// Update state from local storage whenever cacheVersion changes
	useEffect(() => {
		setMounted(true);
		const savedSidebarStateString = localStorage.getItem("anicards-sidebarDefaultOpen");
		if (savedSidebarStateString) {
			const parsedSidebar = JSON.parse(savedSidebarStateString);
			setSidebarDefault(parsedSidebar.value === true);
		}

		// Load cached items and defaults on mount or when local storage updates
		setCachedItems(getSiteSpecificCache());

		const savedPresetString = localStorage.getItem("anicards-defaultColorPreset");
		const presetValue = savedPresetString ? JSON.parse(savedPresetString).value : "default";
		console.log(presetValue);
		setDefaultPreset(presetValue);

		const savedCardTypesString = localStorage.getItem("anicards-defaultCardTypes");
		const cardTypesValue = savedCardTypesString ? JSON.parse(savedCardTypesString).value : [];
		setDefaultCardTypes(cardTypesValue);
	}, [cacheVersion]);

	if (!mounted) return null;

	const handleThemeChange = (value: string) => {
		setTheme(value);
	};

	const handleSidebarDefaultChange = (checked: boolean) => {
		const data = {
			value: checked,
			lastModified: new Date().toISOString(),
		};
		localStorage.setItem("anicards-sidebarDefaultOpen", JSON.stringify(data));
		setSidebarDefault(checked);
		setOpen(checked);
		// Update cacheVersion to trigger a reload of local storage items
		setCacheVersion((v) => v + 1);
	};

	const handleClearCache = () => {
		clearSiteCache();
		setCacheVersion((v) => v + 1);
	};

	const handlePresetChange = (value: string) => {
		const data = {
			value: value,
			lastModified: new Date().toISOString(),
		};
		setDefaultPreset(value);
		localStorage.setItem("anicards-defaultColorPreset", JSON.stringify(data));
		// Trigger update of cached items
		setCacheVersion((v) => v + 1);
	};

	const handleCardTypeToggle = (cardType: string) => {
		const newTypes = defaultCardTypes.includes(cardType)
			? defaultCardTypes.filter((t) => t !== cardType)
			: [...defaultCardTypes, cardType];

		const data = {
			value: newTypes,
			lastModified: new Date().toISOString(),
		};

		setDefaultCardTypes(newTypes);
		localStorage.setItem("anicards-defaultCardTypes", JSON.stringify(data));
		// Trigger update of cached items
		setCacheVersion((v) => v + 1);
	};

	const handleDeleteCacheItem = (key: string) => {
		localStorage.removeItem(`anicards-${key}`);
		setCacheVersion((v) => v + 1);
	};

	const handleToggleAllCardTypes = () => {
		if (defaultCardTypes.length === statCardTypes.length) {
			// Unselect all card types
			const data = {
				value: [],
				lastModified: new Date().toISOString(),
			};
			setDefaultCardTypes([]);
			localStorage.setItem("anicards-defaultCardTypes", JSON.stringify(data));
			setCacheVersion((v) => v + 1);
		} else {
			// Select all card types
			const allTypes = statCardTypes.map((type) => type.id);
			const data = {
				value: allTypes,
				lastModified: new Date().toISOString(),
			};
			setDefaultCardTypes(allTypes);
			localStorage.setItem("anicards-defaultCardTypes", JSON.stringify(data));
			setCacheVersion((v) => v + 1);
		}
	};

	// New: Reset Settings handler
	const handleResetSettings = () => {
		// Remove all keys that store app settings
		const keysToRemove = [
			"anicards-sidebarDefaultOpen",
			"anicards-defaultColorPreset",
			"anicards-defaultCardTypes",
			// Add any additional keys if necessary
		];
		keysToRemove.forEach((key) => localStorage.removeItem(key));
		// Optionally, clear cached data if desired
		clearSiteCache();
		// Trigger a state update so that the UI reflects the reset
		setCacheVersion((v) => v + 1);
	};

	return (
		<motion.div
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.3 }}
			className="settings-container mx-auto px-4 py-8 max-w-3xl"
		>
			<motion.div
				initial={{ scale: 0.95 }}
				animate={{ scale: 1 }}
				transition={{ type: "spring", stiffness: 100, damping: 10 }}
			>
				<Card className="rounded-xl shadow-lg">
					<CardHeader className="overflow-visible">
						<motion.div
							initial={{ opacity: 0, y: -20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.5 }}
							className="overflow-visible"
						>
							<CardTitle className="text-3xl font-bold leading-snug bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
								Application Settings
							</CardTitle>
						</motion.div>
					</CardHeader>
					<CardContent className="space-y-6 p-6">
						<motion.div
							className="space-y-8"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							transition={{ delay: 0.2 }}
						>
							<motion.div
								initial={{ opacity: 0, y: 10 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ delay: 0.3 }}
								className="space-y-4"
							>
								<Label className="text-lg font-medium">Theme Preferences</Label>
								<Select value={theme} onValueChange={handleThemeChange}>
									<SelectTrigger className="w-full max-w-[300px] bg-accent/40">
										<SelectValue placeholder="Select theme" />
									</SelectTrigger>
									<SelectContent className="rounded-lg">
										{themes.map((t) => (
											<SelectItem
												key={t}
												value={t}
												className="transition-colors hover:bg-accent/40"
											>
												{t.charAt(0).toUpperCase() + t.slice(1)}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</motion.div>

							<motion.div
								initial={{ opacity: 0, y: 10 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ delay: 0.4 }}
								className="space-y-4"
							>
								<Label className="text-lg font-medium">Sidebar Behavior</Label>
								<div className="flex items-center justify-between p-4 bg-accent/40 rounded-lg">
									<div>
										<p className="font-medium">Default State</p>
										<p className="text-sm text-muted-foreground">
											{sidebarDefault ? "Expanded" : "Collapsed"} by default
										</p>
									</div>
									<Switch
										checked={sidebarDefault}
										onCheckedChange={handleSidebarDefaultChange}
										className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-input transition-colors"
									/>
								</div>
							</motion.div>

							<motion.div
								initial={{ opacity: 0, y: 10 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ delay: 0.6 }}
								className="space-y-4"
							>
								<Label className="text-lg font-medium">Cache Management</Label>
								<div className="p-4 bg-accent/40 rounded-lg space-y-4">
									<div className="flex items-center justify-between">
										<div>
											<p className="font-medium">Cached Data</p>
											<p className="text-sm text-muted-foreground">
												{cachedItems.length > 0
													? `Storing ${cachedItems.length} items`
													: "No cached data found"}
											</p>
										</div>
										<Button
											variant="destructive"
											onClick={handleClearCache}
											disabled={cachedItems.length === 0}
										>
											Clear All Cache
										</Button>
									</div>
									{cachedItems.length > 0 && (
										<div className="text-sm space-y-1">
											{cachedItems.map((item) => (
												<div
													key={item.key}
													className="flex items-center justify-between"
												>
													<div className="flex-1">
														<span className="text-muted-foreground">
															{item.key}
														</span>
														<span className="text-xs text-muted-foreground/50 ml-2">
															({formatBytes(item.size)})
														</span>
													</div>
													<div className="flex items-center space-x-2">
														<span className="text-xs text-muted-foreground/70">
															{new Date(
																item.lastModified
															).toLocaleDateString()}
														</span>
														<Button
															variant="destructive"
															size="sm"
															onClick={() =>
																handleDeleteCacheItem(item.key)
															}
														>
															Delete
														</Button>
													</div>
												</div>
											))}
										</div>
									)}
								</div>
							</motion.div>

							<motion.div
								initial={{ opacity: 0, y: 10 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ delay: 0.8 }}
								className="space-y-4"
							>
								<Label className="text-lg font-medium">Default Card Settings</Label>
								<div className="space-y-6 p-4 bg-accent/40 rounded-lg">
									<Select
										value={defaultPreset}
										onValueChange={handlePresetChange}
									>
										<SelectTrigger className="w-full max-w-[300px] bg-background">
											<SelectValue placeholder="Select color preset" />
										</SelectTrigger>
										<SelectContent>
											{Object.keys(colorPresets).map((preset) => (
												<SelectItem key={preset} value={preset}>
													{preset.charAt(0).toUpperCase() +
														preset.slice(1)}
												</SelectItem>
											))}
										</SelectContent>
									</Select>

									<div className="space-y-2">
										<Label>Default Card Types</Label>
										<div className="flex mb-2">
											<Button
												variant="outline"
												size="sm"
												onClick={handleToggleAllCardTypes}
											>
												{defaultCardTypes.length === statCardTypes.length
													? "Unselect All"
													: "Select All"}
											</Button>
										</div>
										<div className="grid grid-cols-1 md:grid-cols-2 gap-2">
											{statCardTypes.map((type) => (
												<div
													key={type.id}
													className="flex items-center space-x-2"
												>
													<Checkbox
														id={type.id}
														checked={defaultCardTypes.includes(type.id)}
														onCheckedChange={() =>
															handleCardTypeToggle(type.id)
														}
													/>
													<Label htmlFor={type.id} className="text-sm">
														{type.label.split(" (")[0]}
													</Label>
												</div>
											))}
										</div>
									</div>
								</div>
							</motion.div>

							<motion.div
								initial={{ opacity: 0, y: 10 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ delay: 1 }}
								className="space-y-4"
							>
								<Label className="text-lg font-medium">Reset Settings</Label>
								<div className="p-4 bg-accent/40 rounded-lg flex flex-col space-y-2">
									<Button variant="destructive" onClick={handleResetSettings}>
										Reset to Default Settings
									</Button>
									<p className="text-xs text-muted-foreground">
										This will reset theme, sidebar behavior, and card settings.
									</p>
								</div>
							</motion.div>
						</motion.div>
					</CardContent>
				</Card>
			</motion.div>
		</motion.div>
	);
}
