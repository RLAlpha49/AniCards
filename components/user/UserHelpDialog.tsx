"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import Fuse from "fuse.js";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import {
  USER_HELP_TOPICS,
  topicToSearchText,
  type UserHelpBlock,
  type UserHelpTopic,
} from "./help/user-help-topics";

export interface UserHelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStartTour?: () => void;
}

function renderBlock(block: UserHelpBlock) {
  switch (block.type) {
    case "p":
      return (
        <p className="text-sm text-slate-700 dark:text-slate-300">
          {block.text}
        </p>
      );
    case "note":
      return (
        <div className="rounded-xl border border-slate-200/70 bg-slate-50/70 p-3 text-sm text-slate-700 dark:border-slate-700/70 dark:bg-slate-800/60 dark:text-slate-200">
          <span className="font-semibold">Note:</span> {block.text}
        </div>
      );
    case "ul":
      return (
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-700 dark:text-slate-300">
          {block.items.map((item, idx) => (
            <li key={`${idx}-${item}`}>{item}</li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-slate-700 dark:text-slate-300">
          {block.items.map((item, idx) => (
            <li key={`${idx}-${item}`}>{item}</li>
          ))}
        </ol>
      );
    case "link":
      return block.href.startsWith("/") ? (
        <Link
          href={block.href}
          className="text-sm font-medium text-blue-700 hover:underline dark:text-blue-400"
        >
          {block.label}
        </Link>
      ) : (
        <a
          href={block.href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-blue-700 hover:underline dark:text-blue-400"
        >
          {block.label}
        </a>
      );
    default: {
      const _exhaustiveCheck: never = block;
      return _exhaustiveCheck;
    }
  }
}

/**
 * Small "How it works" dialog for the /user editor.
 *
 * Note: This is a controlled dialog so multiple UI elements can open it.
 */
export function UserHelpDialog({
  open,
  onOpenChange,
  onStartTour,
}: Readonly<UserHelpDialogProps>) {
  const [query, setQuery] = useState("");
  const [selectedTopicId, setSelectedTopicId] = useState<string>(
    USER_HELP_TOPICS[0]?.id ?? "quick-start",
  );

  const indexedTopics = useMemo(
    () =>
      USER_HELP_TOPICS.map((topic) => ({
        topic,
        searchText: topicToSearchText(topic),
      })),
    [],
  );

  const fuse = useMemo(
    () =>
      new Fuse(indexedTopics, {
        includeScore: true,
        threshold: 0.35,
        ignoreLocation: true,
        keys: ["topic.title", "topic.summary", "topic.keywords", "searchText"],
      }),
    [indexedTopics],
  );

  const filteredTopics: UserHelpTopic[] = useMemo(() => {
    const q = query.trim();
    if (!q) return USER_HELP_TOPICS;
    return fuse.search(q).map((r) => r.item.topic);
  }, [fuse, query]);

  const selectedTopic = useMemo(
    () =>
      filteredTopics.find((t) => t.id === selectedTopicId) ??
      filteredTopics[0] ??
      null,
    [filteredTopics, selectedTopicId],
  );

  const didResetRef = useRef(false);

  useEffect(() => {
    if (!open) {
      didResetRef.current = false;
      return;
    }

    // Reset search only when dialog first opens
    if (!didResetRef.current) {
      setQuery("");
      didResetRef.current = true;
    }

    if (
      selectedTopicId &&
      filteredTopics.some((t) => t.id === selectedTopicId)
    ) {
      return;
    }
    setSelectedTopicId(filteredTopics[0]?.id ?? "quick-start");
  }, [filteredTopics, open, selectedTopicId]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overlay-scrollbar max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Help: How your AniCards page works</DialogTitle>
          <DialogDescription>
            Search help topics, learn the key controls, or start a guided tour.
            Tip: press Ctrl/Cmd+H to open this dialog, and see the “Keyboard
            shortcuts” topic for the full list.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[240px_1fr]">
          {/* Left: search + topics */}
          <div className="space-y-3">
            <div className="space-y-2">
              <label
                htmlFor="user-help-search"
                className="text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Search
              </label>
              <Input
                id="user-help-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search help..."
                className="h-9 rounded-xl"
              />
            </div>

            <nav aria-label="Help topics" className="space-y-1">
              {filteredTopics.length === 0 ? (
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  No results. Try a different search.
                </p>
              ) : (
                filteredTopics.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedTopicId(t.id)}
                    className={cn(
                      "w-full rounded-xl px-3 py-2 text-left text-sm transition-colors",
                      t.id === selectedTopicId
                        ? "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white"
                        : "text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/60",
                    )}
                    aria-current={t.id === selectedTopicId ? "page" : undefined}
                  >
                    <div className="font-semibold">{t.title}</div>
                    <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {t.summary}
                    </div>
                  </button>
                ))
              )}
            </nav>
          </div>

          {/* Right: selected topic */}
          <div className="min-w-0 rounded-2xl border border-slate-200/70 bg-white/60 p-4 backdrop-blur-sm dark:border-slate-700/70 dark:bg-slate-900/30">
            {selectedTopic ? (
              <article aria-label={selectedTopic.title} className="space-y-3">
                <header>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                    {selectedTopic.title}
                  </h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    {selectedTopic.summary}
                  </p>
                </header>

                <div className="space-y-3">
                  {selectedTopic.blocks.map((block, idx) => (
                    <div key={`${selectedTopic.id}-${idx}`}>
                      {renderBlock(block)}
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                  {onStartTour ? (
                    <Button
                      type="button"
                      variant="secondary"
                      className="w-full rounded-xl sm:w-auto"
                      onClick={onStartTour}
                    >
                      Start guided tour
                    </Button>
                  ) : null}

                  <Button
                    variant="outline"
                    className="w-full rounded-xl sm:w-auto"
                    asChild
                  >
                    <Link href="/examples">View examples</Link>
                  </Button>

                  <DialogClose asChild>
                    <Button
                      type="button"
                      className="w-full rounded-xl sm:w-auto"
                    >
                      Close
                    </Button>
                  </DialogClose>
                </div>
              </article>
            ) : (
              <div className="text-sm text-slate-600 dark:text-slate-400">
                Pick a topic to get started.
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
