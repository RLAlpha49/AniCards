import React from "react";
import { motion } from "framer-motion";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/utils";

export interface CacheItem {
  key: string;
  size: number;
  lastModified: string;
}

interface CacheManagementProps {
  cachedItems: CacheItem[];
  onClearCache: () => void;
  onDeleteCacheItem: (key: string) => void;
}

export function CacheManagement({
  cachedItems,
  onClearCache,
  onDeleteCacheItem,
}: Readonly<CacheManagementProps>) {
  const totalSize = cachedItems.reduce((sum, item) => sum + item.size, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="h-full"
    >
      <div className="flex h-full flex-col rounded-2xl border border-white/50 bg-white/80 p-6 shadow-xl backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/80">
        <div className="mb-6 flex items-center gap-4">
          <div className="rounded-xl bg-gradient-to-br from-orange-500 to-red-600 p-3 shadow-lg shadow-orange-500/20">
            <svg
              className="h-6 w-6 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"
              />
            </svg>
          </div>
          <div>
            <Label className="text-xl font-bold text-slate-900 dark:text-white">
              Cache Management
            </Label>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Manage stored data to improve loading times and performance
            </p>
          </div>
        </div>

        {/* Cache Statistics */}
        <div className="mb-6 grid grid-cols-2 gap-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-center backdrop-blur-sm dark:border-slate-700 dark:bg-slate-800/50">
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
              {cachedItems.length}
            </div>
            <div className="text-sm font-medium text-slate-600 dark:text-slate-300">
              Items
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-center backdrop-blur-sm dark:border-slate-700 dark:bg-slate-800/50">
            <div className="text-3xl font-bold text-green-600 dark:text-green-400">
              {formatBytes(totalSize)}
            </div>
            <div className="text-sm font-medium text-slate-600 dark:text-slate-300">
              Total Size
            </div>
          </div>
        </div>
        {/* Clear Cache Button */}
        <div className="mb-8 flex justify-center">
          <Button
            variant="destructive"
            onClick={onClearCache}
            disabled={cachedItems.length === 0}
            className="w-full max-w-xs rounded-full bg-gradient-to-r from-red-500 to-red-600 py-6 text-base font-semibold shadow-lg transition-all hover:scale-105 hover:from-red-600 hover:to-red-700 hover:shadow-red-500/25 disabled:opacity-50"
          >
            Clear All Cache
          </Button>
        </div>

        {/* Cache Items Table */}
        {cachedItems.length > 0 ? (
          <div className="space-y-4">
            <h3 className="font-semibold text-slate-900 dark:text-white">
              Cached Items
            </h3>
            <div className="scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700 max-h-80 space-y-3 overflow-y-auto pr-2">
              {cachedItems.map((item) => (
                <motion.div
                  key={item.key}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:shadow-md dark:border-slate-700 dark:bg-slate-800"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-900 dark:text-white">
                      {item.key}
                    </p>
                    <div className="mt-1 flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1">
                        <svg
                          className="h-3.5 w-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m-9 0h10a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2z"
                          />
                        </svg>
                        {formatBytes(item.size)}
                      </span>
                      <span className="flex items-center gap-1">
                        <svg
                          className="h-3.5 w-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        {new Date(item.lastModified).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDeleteCacheItem(item.key)}
                    className="ml-3 h-8 w-8 rounded-full p-0 text-red-500 hover:bg-red-50 hover:text-red-600 dark:text-red-400 dark:hover:bg-red-900/20"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </Button>
                </motion.div>
              ))}
            </div>
          </div>
        ) : (
          <div className="py-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
              <svg
                className="h-8 w-8 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <p className="text-lg font-medium text-slate-900 dark:text-white">
              No cached data found
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Data will appear here as you use the application
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
