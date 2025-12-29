"use client";

import { useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { ImageWithSkeleton } from "@/components/ImageWithSkeleton";
import { Copy, Check, Play, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Data representing a card to display in the lightbox.
 * @source
 */
export interface LightboxCardData {
  /** The name/title of the card variant */
  name: string;
  /** The URL to the card image */
  url: string;
  /** The parent card type title (e.g., "Anime Statistics") */
  cardTypeTitle: string;
  /** The category this card belongs to */
  category: string;
  /** Optional description */
  description?: string;
}

interface CardLightboxModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback to close the modal */
  onClose: () => void;
  /** The card data to display */
  card: LightboxCardData | null;
  /** Callback when user clicks "Create Your Own" */
  onCreateYourOwn: () => void;
}

const contentVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 10 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.25, ease: "easeOut" as const },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: 10,
    transition: { duration: 0.15, ease: "easeIn" as const },
  },
};

/**
 * Fullscreen lightbox modal for viewing cards at full size.
 * Features smooth animations, copy embed URL functionality, and keyboard navigation.
 * @source
 */
export function CardLightboxModal({
  isOpen,
  onClose,
  card,
  onCreateYourOwn,
}: Readonly<CardLightboxModalProps>) {
  const [copied, setCopied] = useState(false);

  const handleCopyEmbed = useCallback(async () => {
    if (!card) return;
    try {
      await navigator.clipboard.writeText(card.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  }, [card]);

  if (!card) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AnimatePresence mode="wait">
        {isOpen && (
          <DialogContent
            hideCloseButton
            className={cn(
              "max-h-[90vh] w-[95vw] max-w-5xl overflow-hidden rounded-2xl border-0",
              "bg-white/95 p-0 shadow-2xl backdrop-blur-xl",
              "dark:bg-slate-900/95",
            )}
            asChild
          >
            <motion.div
              variants={contentVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              {/* Custom Close Button */}
              <button
                onClick={onClose}
                className={cn(
                  "absolute right-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-full",
                  "bg-slate-100/80 text-slate-600 backdrop-blur-sm transition-all",
                  "hover:bg-slate-200/80 hover:text-slate-900",
                  "dark:bg-slate-800/80 dark:text-slate-400",
                  "dark:hover:bg-slate-700/80 dark:hover:text-white",
                )}
                aria-label="Close lightbox"
              >
                <X className="h-5 w-5" />
              </button>

              {/* Card Preview Area */}
              <div className="relative flex items-center justify-center bg-gradient-to-br from-slate-100 via-slate-50 to-slate-100 p-8 dark:from-slate-800 dark:via-slate-900 dark:to-slate-800 sm:p-12">
                {/* Decorative gradient blob */}
                <div className="absolute inset-0 overflow-hidden">
                  <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 blur-3xl" />
                  <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-gradient-to-r from-cyan-500/10 to-blue-500/10 blur-3xl" />
                </div>

                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1, duration: 0.3 }}
                  className="relative max-h-[50vh] w-full max-w-3xl"
                >
                  <ImageWithSkeleton
                    src={card.url}
                    alt={`${card.cardTypeTitle} - ${card.name}`}
                    className="h-auto w-full rounded-xl shadow-2xl"
                    containerClassName="flex items-center justify-center"
                  />
                </motion.div>
              </div>

              {/* Card Info and Actions */}
              <div className="border-t border-slate-200/50 bg-white p-6 dark:border-slate-700/50 dark:bg-slate-900 sm:p-8">
                <DialogHeader className="mb-6 text-left">
                  <div className="mb-2 flex items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium",
                        "bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10",
                        "text-purple-700 dark:text-purple-300",
                      )}
                    >
                      {card.category}
                    </span>
                  </div>
                  <DialogTitle className="text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
                    {card.name}
                  </DialogTitle>
                  <DialogDescription className="mt-2 text-base text-slate-600 dark:text-slate-400">
                    {card.cardTypeTitle}
                    {card.description && ` — ${card.description}`}
                  </DialogDescription>
                </DialogHeader>

                {/* Action Buttons */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Button
                    onClick={handleCopyEmbed}
                    variant="outline"
                    className={cn(
                      "h-12 gap-2 rounded-full border-slate-200 px-6",
                      "hover:border-purple-300 hover:bg-purple-50",
                      "dark:border-slate-700 dark:hover:border-purple-700 dark:hover:bg-purple-950/50",
                      copied &&
                        "border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-950/50",
                    )}
                  >
                    {copied ? (
                      <>
                        <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                        <span className="text-green-600 dark:text-green-400">
                          Copied!
                        </span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        Copy Embed URL
                      </>
                    )}
                  </Button>

                  <Button
                    onClick={() => {
                      onCreateYourOwn();
                      onClose();
                    }}
                    className={cn(
                      "group h-12 gap-2 rounded-full px-6",
                      "bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600",
                      "font-semibold text-white shadow-lg shadow-purple-500/25",
                      "transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-purple-500/30",
                    )}
                  >
                    <Play className="h-4 w-4 fill-current" />
                    Create Your Own
                  </Button>
                </div>
              </div>
            </motion.div>
          </DialogContent>
        )}
      </AnimatePresence>
    </Dialog>
  );
}
