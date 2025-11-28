import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { formatBytes } from "@/lib/utils";
import {
  Database,
  Trash2,
  HardDrive,
  Clock,
  FileBox,
  Sparkles,
} from "lucide-react";

/**
 * Represents a cached item with size and last-modified metadata.
 * @property key - Storage key identifying the cached entry.
 * @property size - Item size in bytes.
 * @property lastModified - ISO string for the last modification time.
 * @source
 */
export interface CacheItem {
  key: string;
  size: number;
  lastModified: string;
}

/**
 * Props for the CacheManagement component.
 * @property cachedItems - Array of cache items to display.
 * @property onClearCache - Invoked to clear all cached items.
 * @property onDeleteCacheItem - Invoked to delete a cache item by key.
 * @source
 */
interface CacheManagementProps {
  cachedItems: CacheItem[];
  onClearCache: () => void;
  onDeleteCacheItem: (key: string) => void;
}

/**
 * Renders a UI for managing client-side cache.
 * Shows summary statistics, a list of cached items, and actions to clear or delete cache.
 * @param cachedItems - Items currently stored in cache.
 * @param onClearCache - Callback to clear all cached data.
 * @param onDeleteCacheItem - Callback to delete a specific cache item by key.
 * @returns A React element representing cache management UI.
 * @source
 */
export function CacheManagement({
  cachedItems,
  onClearCache,
  onDeleteCacheItem,
}: Readonly<CacheManagementProps>) {
  // Aggregate total size (in bytes) of all cached items for display.
  const totalSize = cachedItems.reduce((sum, item) => sum + item.size, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="h-full"
    >
      <div className="flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200/50 bg-gradient-to-br from-white/80 via-white/60 to-slate-100/80 shadow-xl shadow-slate-200/50 backdrop-blur-xl dark:border-slate-700/50 dark:from-slate-800/80 dark:via-slate-800/60 dark:to-slate-900/80 dark:shadow-slate-900/50">
        {/* Header */}
        <div className="border-b border-slate-200/50 bg-white/50 p-6 dark:border-slate-700/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-4">
            <div className="rounded-2xl bg-gradient-to-br from-orange-500 via-red-500 to-pink-500 p-3.5 shadow-lg shadow-orange-500/25">
              <Database className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                Cache Management
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Manage stored data to improve performance
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col p-6">
          {/* Statistics Cards */}
          <div className="mb-6 grid grid-cols-2 gap-4">
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="rounded-2xl border border-slate-200/50 bg-gradient-to-br from-blue-50 to-cyan-50 p-5 shadow-sm dark:border-slate-700/50 dark:from-blue-900/20 dark:to-cyan-900/20"
            >
              <div className="mb-2 flex items-center gap-2">
                <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-900/50">
                  <FileBox className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                {cachedItems.length}
              </div>
              <div className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Cached Items
              </div>
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.02 }}
              className="rounded-2xl border border-slate-200/50 bg-gradient-to-br from-green-50 to-emerald-50 p-5 shadow-sm dark:border-slate-700/50 dark:from-green-900/20 dark:to-emerald-900/20"
            >
              <div className="mb-2 flex items-center gap-2">
                <div className="rounded-lg bg-green-100 p-2 dark:bg-green-900/50">
                  <HardDrive className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                {formatBytes(totalSize)}
              </div>
              <div className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Total Size
              </div>
            </motion.div>
          </div>

          {/* Clear Cache Button */}
          <div className="mb-6">
            <Button
              variant="destructive"
              onClick={onClearCache}
              disabled={cachedItems.length === 0}
              className="group h-12 w-full rounded-xl bg-gradient-to-r from-red-500 via-red-600 to-rose-600 font-semibold shadow-lg shadow-red-500/25 transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-red-500/30 disabled:from-slate-400 disabled:to-slate-500 disabled:opacity-50 disabled:shadow-none"
            >
              <Trash2 className="mr-2 h-4 w-4 transition-transform group-hover:scale-110" />
              Clear All Cache
            </Button>
          </div>

          {/* Cache Items List */}
          <div className="flex-1">
            {cachedItems.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-slate-900 dark:text-white">
                    Cached Items
                  </h4>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {cachedItems.length} item
                    {cachedItems.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700 max-h-64 space-y-2 overflow-y-auto pr-1">
                  <AnimatePresence mode="popLayout">
                    {cachedItems.map((item, index) => (
                      <motion.div
                        key={item.key}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20, scale: 0.95 }}
                        transition={{ delay: index * 0.05 }}
                        className="group flex items-center justify-between rounded-xl border border-slate-200/50 bg-white/80 p-4 shadow-sm transition-all hover:border-slate-300 hover:shadow-md dark:border-slate-700/50 dark:bg-slate-800/80 dark:hover:border-slate-600"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-slate-900 dark:text-white">
                            {item.key}
                          </p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                            <span className="flex items-center gap-1.5 rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-700/50">
                              <HardDrive className="h-3 w-3" />
                              {formatBytes(item.size)}
                            </span>
                            <span className="flex items-center gap-1.5 rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-700/50">
                              <Clock className="h-3 w-3" />
                              {new Date(item.lastModified).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDeleteCacheItem(item.key)}
                          className="ml-3 h-9 w-9 rounded-xl p-0 text-slate-400 opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-1 flex-col items-center justify-center py-8 text-center"
              >
                <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700">
                  <Sparkles className="h-10 w-10 text-slate-400 dark:text-slate-500" />
                </div>
                <p className="text-lg font-semibold text-slate-900 dark:text-white">
                  No cached data
                </p>
                <p className="mt-1 max-w-[200px] text-sm text-slate-500 dark:text-slate-400">
                  Data will appear here as you use the application
                </p>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
