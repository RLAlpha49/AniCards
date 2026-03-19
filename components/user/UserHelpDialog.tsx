"use client";

import Fuse from "fuse.js";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";

import {
  topicToSearchText,
  USER_HELP_TOPICS,
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
      return <p className="text-muted-foreground text-sm">{block.text}</p>;
    case "note":
      return (
        <div className="border-gold/20 bg-gold/3 text-foreground dark:border-gold/15 dark:bg-gold/3 rounded-xl border p-3 text-sm">
          <span className="font-semibold">Note:</span> {block.text}
        </div>
      );
    case "ul":
      return (
        <ul className="text-muted-foreground list-disc space-y-1.5 pl-5 text-sm">
          {block.items.map((item, idx) => (
            <li key={`${idx}-${item}`}>{item}</li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol className="text-muted-foreground list-decimal space-y-1.5 pl-5 text-sm">
          {block.items.map((item, idx) => (
            <li key={`${idx}-${item}`}>{item}</li>
          ))}
        </ol>
      );
    case "link":
      return block.href.startsWith("/") ? (
        <Link
          href={block.href}
          className="text-gold-dim dark:text-gold text-sm font-medium hover:underline"
        >
          {block.label}
        </Link>
      ) : (
        <a
          href={block.href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-gold-dim dark:text-gold text-sm font-medium hover:underline"
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
          <div className="space-y-3">
            <div className="space-y-2">
              <label
                htmlFor="user-help-search"
                className="text-foreground text-xs font-semibold"
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
                <p className="text-muted-foreground text-sm">
                  No results. Try a different search.
                </p>
              ) : (
                filteredTopics.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedTopicId(t.id)}
                    className={cn(
                      "w-full border-l-2 border-transparent px-3 py-2 text-left text-sm transition-all",
                      t.id === selectedTopicId
                        ? "border-l-gold bg-gold/10 text-foreground dark:bg-gold/10"
                        : "text-muted-foreground hover:border-l-gold/40 hover:bg-gold/5 dark:hover:bg-gold/5",
                    )}
                    aria-current={t.id === selectedTopicId ? "page" : undefined}
                  >
                    <div className="font-semibold">{t.title}</div>
                    <div className="text-muted-foreground mt-0.5 text-xs">
                      {t.summary}
                    </div>
                  </button>
                ))
              )}
            </nav>
          </div>

          <div className="border-gold/15 bg-gold/3 dark:border-gold/15 dark:bg-gold/3 min-w-0 border-2 p-4 backdrop-blur-sm">
            {selectedTopic ? (
              <article aria-label={selectedTopic.title} className="space-y-3">
                <header>
                  <h3 className="text-foreground font-display text-base font-semibold">
                    {selectedTopic.title}
                  </h3>
                  <p className="text-muted-foreground mt-1 text-sm">
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
              <div className="text-muted-foreground text-sm">
                Pick a topic to get started.
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
