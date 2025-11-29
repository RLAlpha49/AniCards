"use client";

import { useTheme } from "next-themes";
import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useUserPreferences, useCardSettings, useCache } from "@/lib/stores";
import { ThemePreferences } from "@/components/settings/ThemePreferences";
import { CacheManagement } from "@/components/settings/CacheManagement";
import { DefaultCardSettings } from "@/components/settings/DefaultCardSettings";
import { ResetSettings } from "@/components/settings/ResetSettings";
import { DefaultUsernameSettings } from "@/components/settings/DefaultUsername";
import { usePageSEO } from "@/hooks/usePageSEO";
import PageShell from "@/components/PageShell";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Settings } from "lucide-react";

/**
 * Animation variants for staggered content reveal.
 * @source
 */
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

/**
 * Renders the global settings shell and wires persistent preferences to the UI.
 * @source
 */
export default function SettingsPage() {
  usePageSEO("settings");

  const { setTheme, theme, themes } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Zustand stores
  const { defaultUsername, setDefaultUsername, resetUserPreferences } =
    useUserPreferences();

  const {
    defaultCardTypes,
    defaultVariants,
    defaultShowFavoritesByCard,
    setDefaultCardTypes,
    toggleCardType,
    setDefaultVariant,
    toggleShowFavorites,
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
      require("@/components/StatCardGenerator").statCardTypes;
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

  return (
    <ErrorBoundary>
      <PageShell
        backgroundClassName="fixed inset-0 -z-10"
        heroContent={
          <section className="relative w-full overflow-hidden">
            <div className="container relative z-10 mx-auto px-4">
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="mx-auto flex max-w-4xl flex-col items-center text-center"
              >
                {/* Badge */}
                <motion.div variants={itemVariants}>
                  <span className="inline-flex items-center gap-2 rounded-full border border-blue-200/50 bg-blue-50/80 px-4 py-2 text-sm font-medium text-blue-700 shadow-sm backdrop-blur-sm dark:border-blue-700/50 dark:bg-blue-950/50 dark:text-blue-300">
                    <Settings className="h-4 w-4" />
                    Personalization Center
                  </span>
                </motion.div>

                {/* Main heading */}
                <motion.h1
                  variants={itemVariants}
                  className="mt-8 text-4xl font-extrabold leading-[1.1] tracking-tight text-slate-900 dark:text-white sm:text-5xl md:text-6xl"
                >
                  Application{" "}
                  <span className="relative">
                    <span className="relative z-10 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                      Settings
                    </span>
                    <motion.span
                      className="absolute -inset-1 -z-10 block rounded-lg bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-pink-600/20 blur-xl"
                      animate={{ opacity: [0.5, 0.8, 0.5] }}
                      transition={{ duration: 3, repeat: Infinity }}
                    />
                  </span>
                </motion.h1>

                {/* Subheading */}
                <motion.p
                  variants={itemVariants}
                  className="mt-6 max-w-2xl text-lg text-slate-600 dark:text-slate-300 sm:text-xl"
                >
                  Customize your AniCards experience with personalization
                  options, theme preferences, and default configurations.
                </motion.p>
              </motion.div>
            </div>
          </section>
        }
        mainClassName="pt-20 lg:pt-28"
      >
        {/* Settings Container */}
        <section className="relative w-full overflow-hidden py-20 lg:py-28">
          <div className="container relative mx-auto px-4">
            <div className="mx-auto max-w-6xl">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="grid grid-cols-1 gap-8 lg:grid-cols-2"
              >
                {/* Left Column */}
                <div className="space-y-8">
                  <ThemePreferences
                    theme={theme || "system"}
                    themes={themes}
                    onThemeChange={handleThemeChange}
                  />
                </div>

                {/* Right Column */}
                <div className="space-y-8">
                  <DefaultUsernameSettings
                    defaultUsername={defaultUsername}
                    onUsernameChange={handleDefaultUsernameChange}
                  />
                </div>

                {/* Full Width Card Settings */}
                <div className="col-span-1 lg:col-span-2">
                  <DefaultCardSettings
                    defaultCardTypes={defaultCardTypes}
                    defaultVariants={defaultVariants}
                    onToggleCardType={handleCardTypeToggle}
                    onToggleAllCardTypes={handleToggleAllCardTypes}
                    onVariantChange={handleVariantChange}
                    defaultShowFavoritesByCard={defaultShowFavoritesByCard}
                    onToggleShowFavoritesDefault={
                      handleToggleShowFavoritesDefault
                    }
                  />
                </div>

                {/* Reset Settings */}
                <div className="col-span-1 lg:col-span-2">
                  <ResetSettings onReset={handleResetSettings} />
                </div>
              </motion.div>
            </div>
          </div>
        </section>
      </PageShell>
    </ErrorBoundary>
  );
}
