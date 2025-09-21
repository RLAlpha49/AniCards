"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useSidebar } from "@/components/ui/sidebar";
import { getSiteSpecificCache, clearSiteCache } from "@/lib/data";
import { ThemePreferences } from "@/components/settings/theme-preferences";
import { SidebarBehavior } from "@/components/settings/sidebar-behavior";
import {
  CacheManagement,
  CacheItem,
} from "@/components/settings/cache-management";
import { DefaultCardSettings } from "@/components/settings/default-card-settings";
import { ResetSettings } from "@/components/settings/reset-settings";
import { DefaultUsernameSettings } from "@/components/settings/default-username";
import { usePageSEO } from "@/hooks/use-page-seo";

export default function SettingsPage() {
  usePageSEO("settings");

  const { setTheme, theme, themes } = useTheme();
  const { open, setOpen } = useSidebar();
  const [mounted, setMounted] = useState(false);
  const [sidebarDefault, setSidebarDefault] = useState(open);
  const [cachedItems, setCachedItems] = useState<CacheItem[]>([]);
  const [defaultPreset, setDefaultPreset] = useState("default");
  const [defaultCardTypes, setDefaultCardTypes] = useState<string[]>([]);
  const [defaultUsername, setDefaultUsername] = useState("");
  const [cacheVersion, setCacheVersion] = useState(0);
  const [defaultVariants, setDefaultVariants] = useState<
    Record<string, string>
  >({});
  const [defaultShowFavoritesByCard, setDefaultShowFavoritesByCard] = useState<
    Record<string, boolean>
  >(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("anicards-defaultShowFavoritesByCard");
      if (saved) return JSON.parse(saved).value;
    }
    return {};
  });

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
    const savedSidebarStateString = localStorage.getItem(
      "anicards-sidebarDefaultOpen",
    );
    if (savedSidebarStateString) {
      const parsedSidebar = JSON.parse(savedSidebarStateString);
      setSidebarDefault(parsedSidebar.value === true);
    }

    // Load cached items and defaults on mount or when local storage updates
    setCachedItems(getSiteSpecificCache());

    const savedPresetString = localStorage.getItem(
      "anicards-defaultColorPreset",
    );
    const presetValue = savedPresetString
      ? JSON.parse(savedPresetString).value
      : "default";
    setDefaultPreset(presetValue);

    const savedCardTypesString = localStorage.getItem(
      "anicards-defaultCardTypes",
    );
    const cardTypesValue = savedCardTypesString
      ? JSON.parse(savedCardTypesString).value
      : [];
    setDefaultCardTypes(cardTypesValue);

    // Load the default username
    const savedUsernameString = localStorage.getItem(
      "anicards-defaultUsername",
    );
    const usernameValue = savedUsernameString
      ? JSON.parse(savedUsernameString).value
      : "";
    setDefaultUsername(usernameValue);

    // Load default variants
    const savedVariantsString = localStorage.getItem(
      "anicards-defaultVariants",
    );
    const variantsValue = savedVariantsString
      ? JSON.parse(savedVariantsString).value
      : {};
    setDefaultVariants(variantsValue);

    // Load default show favorites by card
    const savedShowFavoritesString = localStorage.getItem(
      "anicards-defaultShowFavoritesByCard",
    );
    const showFavoritesValue = savedShowFavoritesString
      ? JSON.parse(savedShowFavoritesString).value
      : {};
    setDefaultShowFavoritesByCard(showFavoritesValue);
  }, [cacheVersion]);

  if (!mounted) return null;

  // Handlers for the settings (passed as props)
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
    setCacheVersion((v) => v + 1);
  };

  const handleDeleteCacheItem = (key: string) => {
    localStorage.removeItem(`anicards-${key}`);
    setCacheVersion((v) => v + 1);
  };

  const handleToggleAllCardTypes = () => {
    // Check if all card types are selected (statCardTypes is imported in DefaultCardSettings)
    // This comparison assumes that statCardTypes is available and that each card type has a unique "id".
    // If all types are selected, unselect all; otherwise, select all.
    let allTypes: string[] = [];
    // Dynamically require statCardTypes if needed. Here we mimic that check by comparing array lengths.
    if (
      defaultCardTypes.length ===
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("@/components/stat-card-generator").statCardTypes.length
    ) {
      allTypes = [];
    } else {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      allTypes = require("@/components/stat-card-generator").statCardTypes.map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (type: any) => type.id,
      );
    }
    const data = {
      value: allTypes,
      lastModified: new Date().toISOString(),
    };
    setDefaultCardTypes(allTypes);
    localStorage.setItem("anicards-defaultCardTypes", JSON.stringify(data));
    setCacheVersion((v) => v + 1);

    // Reset variants when unselecting all
    if (allTypes.length === 0) {
      setDefaultVariants({});
      localStorage.removeItem("anicards-defaultVariants");
    }
  };

  const handleResetSettings = () => {
    const keysToRemove = [
      "anicards-sidebarDefaultOpen",
      "anicards-defaultColorPreset",
      "anicards-defaultCardTypes",
      "anicards-defaultUsername",
      "anicards-defaultVariants",
    ];
    keysToRemove.forEach((key) => localStorage.removeItem(key));
    clearSiteCache();
    setCacheVersion((v) => v + 1);
    setDefaultVariants({});
  };

  // New handler for default username change
  const handleDefaultUsernameChange = (value: string) => {
    const data = {
      value,
      lastModified: new Date().toISOString(),
    };
    setDefaultUsername(value);
    localStorage.setItem("anicards-defaultUsername", JSON.stringify(data));
    setCacheVersion((v) => v + 1);
  };

  // Add variant change handler
  const handleVariantChange = (cardType: string, variant: string) => {
    const newVariants = { ...defaultVariants, [cardType]: variant };
    const data = {
      value: newVariants,
      lastModified: new Date().toISOString(),
    };
    setDefaultVariants(newVariants);
    localStorage.setItem("anicards-defaultVariants", JSON.stringify(data));
    setCacheVersion((v) => v + 1);
  };

  // Handler for toggling show favorites default
  const handleToggleShowFavoritesDefault = (cardId: string) => {
    setDefaultShowFavoritesByCard((prev) => {
      const updated = { ...prev, [cardId]: !prev[cardId] };
      localStorage.setItem(
        "anicards-defaultShowFavoritesByCard",
        JSON.stringify({
          value: updated,
          lastModified: new Date().toISOString(),
        }),
      );
      setCacheVersion((v) => v + 1);
      return updated;
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-950 dark:to-indigo-950">
      <div className="container mx-auto px-4 py-12">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-12 text-center"
        >
          <h1 className="mb-4 bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-4xl font-bold text-transparent md:text-5xl">
            Application Settings
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-gray-600 dark:text-gray-300">
            Customize your AniCards experience with these personalization
            options and preferences.
          </p>
        </motion.div>

        {/* Settings Container */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mx-auto max-w-4xl"
        >
          <div className="rounded-2xl border border-white/20 bg-white/10 p-8 shadow-xl backdrop-blur-sm dark:border-gray-700/30 dark:bg-gray-800/20 md:p-12">
            <div className="space-y-12">
              <ThemePreferences
                theme={theme || "system"}
                themes={themes}
                onThemeChange={handleThemeChange}
              />

              <SidebarBehavior
                sidebarDefault={sidebarDefault}
                onSidebarChange={handleSidebarDefaultChange}
              />

              <DefaultUsernameSettings
                defaultUsername={defaultUsername}
                onUsernameChange={handleDefaultUsernameChange}
              />

              <CacheManagement
                cachedItems={cachedItems}
                onClearCache={handleClearCache}
                onDeleteCacheItem={handleDeleteCacheItem}
              />

              <DefaultCardSettings
                defaultPreset={defaultPreset}
                onPresetChange={handlePresetChange}
                defaultCardTypes={defaultCardTypes}
                defaultVariants={defaultVariants}
                onToggleCardType={handleCardTypeToggle}
                onToggleAllCardTypes={handleToggleAllCardTypes}
                onVariantChange={handleVariantChange}
                defaultShowFavoritesByCard={defaultShowFavoritesByCard}
                onToggleShowFavoritesDefault={handleToggleShowFavoritesDefault}
              />

              <ResetSettings onReset={handleResetSettings} />
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
