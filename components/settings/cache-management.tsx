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
      className="space-y-4"
    >
      <div className="rounded-xl border border-white/20 bg-white/10 p-6 backdrop-blur-sm dark:border-gray-700/30 dark:bg-gray-700/20">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-lg bg-gradient-to-r from-orange-500 to-red-500 p-2">
            <svg
              className="h-5 w-5 text-white"
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
            <Label className="text-xl font-semibold text-gray-900 dark:text-white">
              Cache Management
            </Label>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Manage stored data to improve loading times and performance
            </p>
          </div>
        </div>

        {/* Cache Statistics */}
        <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-white/10 bg-white/10 p-4 text-center backdrop-blur-sm dark:border-gray-600/20 dark:bg-gray-600/20">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {cachedItems.length}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-300">
              Items
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/10 p-4 text-center backdrop-blur-sm dark:border-gray-600/20 dark:bg-gray-600/20">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {formatBytes(totalSize)}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-300">
              Total Size
            </div>
          </div>
        </div>
        {/* Clear Cache Button */}
        <div className="mb-6 flex justify-center">
          <Button
            variant="destructive"
            onClick={onClearCache}
            disabled={cachedItems.length === 0}
            className="w-full max-w-xs bg-gradient-to-r from-red-500 to-red-600 transition-all duration-200 hover:from-red-600 hover:to-red-700 hover:shadow-lg disabled:from-gray-400 disabled:to-gray-500"
          >
            Clear All Cache
          </Button>
        </div>

        {/* Cache Items Table */}
        {cachedItems.length > 0 ? (
          <div className="space-y-3">
            <h3 className="font-medium text-gray-900 dark:text-white">
              Cached Items
            </h3>
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {cachedItems.map((item) => (
                <motion.div
                  key={item.key}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="flex items-center justify-between rounded-lg border border-white/10 bg-white/10 p-3 backdrop-blur-sm dark:border-gray-600/20 dark:bg-gray-600/20"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-gray-900 dark:text-white">
                      {item.key}
                    </p>
                    <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-300">
                      <span className="flex items-center gap-1">
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
                            d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m-9 0h10a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2z"
                          />
                        </svg>
                        {formatBytes(item.size)}
                      </span>
                      <span className="flex items-center gap-1">
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
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        {new Date(item.lastModified).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onDeleteCacheItem(item.key)}
                    className="ml-3 border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                  >
                    Delete
                  </Button>
                </motion.div>
              ))}
            </div>
          </div>
        ) : (
          <div className="py-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
              <svg
                className="h-8 w-8 text-gray-400"
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
            <p className="mt-4 text-gray-600 dark:text-gray-300">
              No cached data found
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Data will appear here as you use the application
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
