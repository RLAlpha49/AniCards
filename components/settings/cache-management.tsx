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
}: CacheManagementProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6 }}
      className="space-y-4"
    >
      <Label className="text-lg font-medium">Cache Management</Label>
      <div className="space-y-4 rounded-lg bg-accent/40 p-4">
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
            onClick={onClearCache}
            disabled={cachedItems.length === 0}
          >
            Clear All Cache
          </Button>
        </div>
        {cachedItems.length > 0 && (
          <div className="space-y-1 text-sm">
            {cachedItems.map((item) => (
              <div key={item.key} className="flex items-center justify-between">
                <div className="flex-1">
                  <span className="text-muted-foreground">{item.key}</span>
                  <span className="ml-2 text-xs text-muted-foreground/50">
                    ({formatBytes(item.size)})
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-muted-foreground/70">
                    {new Date(item.lastModified).toLocaleDateString()}
                  </span>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => onDeleteCacheItem(item.key)}
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
  );
}
