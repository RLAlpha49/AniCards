"use client";

import { useTheme } from "next-themes";
import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useSidebar } from "@/components/ui/sidebar";
import { useUserPreferences, useCardSettings, useCache } from "@/lib/stores";
import { ThemePreferences } from "@/components/settings/theme-preferences";
import { SidebarBehavior } from "@/components/settings/sidebar-behavior";
import { CacheManagement } from "@/components/settings/cache-management";
import { DefaultCardSettings } from "@/components/settings/default-card-settings";
import { ResetSettings } from "@/components/settings/reset-settings";
import { DefaultUsernameSettings } from "@/components/settings/default-username";
import { usePageSEO } from "@/hooks/use-page-seo";
import { GridPattern } from "../../components/ui/grid-pattern";

/**
 * Renders the global settings shell and wires persistent preferences to the UI.
 * @source
 */
export default function SettingsPage() {
  usePageSEO("settings");

  const { setTheme, theme, themes } = useTheme();
  const { setOpen } = useSidebar();
  const [mounted, setMounted] = useState(false);

  // Zustand stores
  const {
    sidebarDefaultOpen,
    defaultUsername,
    setSidebarDefaultOpen,
    setDefaultUsername,
    resetUserPreferences,
  } = useUserPreferences();

  const {
    defaultCardTypes,
    defaultVariants,
    defaultShowFavoritesByCard,
    defaultBorderEnabled,
    defaultBorderColor,
    setDefaultCardTypes,
    toggleCardType,
    setDefaultVariant,
    toggleShowFavorites,
    setDefaultBorderEnabled,
    setDefaultBorderColor,
    resetCardSettings,
  } = useCardSettings();

  const {
    getCacheItems,
    clearAllCache,
    deleteCacheItem,
    cacheVersion,
    incrementCacheVersion,
  } = useCache();

  // Compute cached items from store
  const cachedItems = useMemo(
    () => getCacheItems(),
    [cacheVersion, getCacheItems],
  );

  // Listen for local storage changes from other tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key?.startsWith("anicards-")) {
        incrementCacheVersion();
      }
    };

    globalThis.addEventListener("storage", handleStorageChange);
    return () => globalThis.removeEventListener("storage", handleStorageChange);
  }, [incrementCacheVersion]);

  // Mount effect
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  // Handlers for the settings (passed as props)
  /**
   * Apply the selected theme slug and propagate the choice.
   * @param value - Theme identifier from the selector.
   * @source
   */
  const handleThemeChange = (value: string) => {
    setTheme(value);
  };

  /**
   * Persist the preferred sidebar open state.
   * @param checked - Whether the sidebar should default to open.
   * @source
   */
  const handleSidebarDefaultChange = (checked: boolean) => {
    setSidebarDefaultOpen(checked);
    setOpen(checked);
  };

  /**
   * Clear cached site data.
   * @source
   */
  const handleClearCache = () => {
    clearAllCache();
  };

  /**
   * Toggle inclusion of a stat card type in the default selection.
   * @param cardType - Identifier that represents the stat card.
   * @source
   */
  const handleCardTypeToggle = (cardType: string) => {
    toggleCardType(cardType);
  };

  /**
   * Remove a cached entry for a specific key.
   * @param key - Cache suffix used in localStorage under the "anicards-" namespace.
   * @source
   */
  const handleDeleteCacheItem = (key: string) => {
    deleteCacheItem(key);
  };

  /**
   * Select or deselect every stat card type and reset variants if clearing.
   * @source
   */
  const handleToggleAllCardTypes = () => {
    // Check if all card types are selected
    const statCardTypesModule =
      require("@/components/stat-card-generator").statCardTypes;
    const allTypes: string[] = statCardTypesModule.map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (type: any) => type.id,
    );

    if (defaultCardTypes.length === allTypes.length) {
      // Deselect all
      setDefaultCardTypes([]);
    } else {
      // Select all
      setDefaultCardTypes(allTypes);
    }
  };

  /**
   * Clear all saved preferences and restore the default cache and border settings.
   * @source
   */
  const handleResetSettings = () => {
    resetUserPreferences();
    resetCardSettings();
    clearAllCache();
  };

  /**
   * Persist the new default username.
   * @param value - Username string provided by the user.
   * @source
   */
  const handleDefaultUsernameChange = (value: string) => {
    setDefaultUsername(value);
  };

  /**
   * Persist the variant choice for a specific card type.
   * @param cardType - Stat card identifier that owns the variant.
   * @param variant - Variant slug chosen in the UI.
   * @source
   */
  const handleVariantChange = (cardType: string, variant: string) => {
    setDefaultVariant(cardType, variant);
  };

  /**
   * Flip the default favorites visibility flag for a given card.
   * @param cardId - Identifier for the card whose preference is toggled.
   * @source
   */
  const handleToggleShowFavoritesDefault = (cardId: string) => {
    toggleShowFavorites(cardId);
  };

  /**
   * Persist the default border enabled flag.
   * @param value - Whether borders should be enabled by default.
   * @source
   */
  const handleBorderEnabledChange = (value: boolean) => {
    setDefaultBorderEnabled(value);
  };

  /**
   * Persist the default border color selection.
   * @param value - Hex or CSS color string chosen by the user.
   * @source
   */
  const handleBorderColorChange = (value: string) => {
    setDefaultBorderColor(value);
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-50 dark:bg-slate-950">
      <GridPattern className="z-0" includeGradients={true} />

      <div className="container relative z-10 mx-auto px-4 py-12">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-12 text-center"
        >
          <h1 className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text pb-4 text-4xl font-extrabold text-transparent md:text-5xl">
            Application Settings
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-slate-600 dark:text-slate-300">
            Customize your AniCards experience with these personalization
            options and preferences.
          </p>
        </motion.div>

        {/* Settings Container */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mx-auto grid max-w-6xl grid-cols-1 gap-6 lg:grid-cols-2"
        >
          <div className="space-y-6">
            <ThemePreferences
              theme={theme || "system"}
              themes={themes}
              onThemeChange={handleThemeChange}
            />

            <SidebarBehavior
              sidebarDefault={sidebarDefaultOpen}
              onSidebarChange={handleSidebarDefaultChange}
            />

            <DefaultUsernameSettings
              defaultUsername={defaultUsername}
              onUsernameChange={handleDefaultUsernameChange}
            />
          </div>

          <div className="space-y-6">
            <CacheManagement
              cachedItems={cachedItems}
              onClearCache={handleClearCache}
              onDeleteCacheItem={handleDeleteCacheItem}
            />
          </div>

          <div className="col-span-1 lg:col-span-2">
            <DefaultCardSettings
              defaultCardTypes={defaultCardTypes}
              defaultVariants={defaultVariants}
              onToggleCardType={handleCardTypeToggle}
              onToggleAllCardTypes={handleToggleAllCardTypes}
              onVariantChange={handleVariantChange}
              defaultShowFavoritesByCard={defaultShowFavoritesByCard}
              onToggleShowFavoritesDefault={handleToggleShowFavoritesDefault}
              defaultBorderEnabled={defaultBorderEnabled}
              defaultBorderColor={defaultBorderColor}
              onBorderEnabledChange={handleBorderEnabledChange}
              onBorderColorChange={handleBorderColorChange}
            />
          </div>
          <div className="col-span-2 flex items-center justify-center">
            <ResetSettings onReset={handleResetSettings} />
          </div>
        </motion.div>
      </div>
    </div>
  );
}
