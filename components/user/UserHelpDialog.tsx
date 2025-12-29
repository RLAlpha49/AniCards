"use client";

import Link from "next/link";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";

export interface UserHelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Small "How it works" dialog for the /user editor.
 *
 * Note: This is a controlled dialog so multiple UI elements can open it.
 */
export function UserHelpDialog({
  open,
  onOpenChange,
}: Readonly<UserHelpDialogProps>) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overlay-scrollbar max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Help: How your AniCards page works</DialogTitle>
          <DialogDescription>
            Enable the cards you want, customize the look, then copy or download
            the results for your AniList profile.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <section aria-labelledby="user-help-quick-start">
            <h3
              id="user-help-quick-start"
              className="text-base font-semibold text-slate-900 dark:text-white"
            >
              Quick start
            </h3>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-slate-700 dark:text-slate-300">
              <li>
                Toggle cards on/off in <strong>Your Cards</strong>.
              </li>
              <li>
                Use <strong>Global Settings</strong> to choose a default color
                preset and border style.
              </li>
              <li>
                Open a card’s actions to copy a URL, copy AniList-formatted text,
                or download an image.
              </li>
            </ul>
          </section>

          <section aria-labelledby="user-help-bulk-actions">
            <h3
              id="user-help-bulk-actions"
              className="text-base font-semibold text-slate-900 dark:text-white"
            >
              Bulk actions
            </h3>
            <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
              Select multiple cards using the checkbox on each card. When at
              least one card is selected, a bulk toolbar appears with actions
              like copying or downloading in one go.
            </p>
          </section>

          <section aria-labelledby="user-help-sharing">
            <h3
              id="user-help-sharing"
              className="text-base font-semibold text-slate-900 dark:text-white"
            >
              Sharing & embedding
            </h3>
            <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
              Each enabled card has a shareable URL that always reflects your
              latest stats (updated daily). Paste links into your AniList bio.
            </p>
          </section>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <Button
              variant="outline"
              className="w-full rounded-xl sm:w-auto"
              onClick={() => onOpenChange(false)}
              asChild
            >
              <Link href="/examples">View examples</Link>
            </Button>

            <DialogClose asChild>
              <Button type="button" className="w-full rounded-xl sm:w-auto">
                Got it
              </Button>
            </DialogClose>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
