"use client";

import type Fuse from "fuse.js";
import {
  Command,
  Copy,
  Download,
  FileJson,
  Filter,
  GripVertical,
  Keyboard,
  Layers,
  type LucideIcon,
  Map,
  Palette,
  Save,
  Search,
  Settings,
  Share2,
  SlidersHorizontal,
  Sparkles,
  SquareStack,
} from "lucide-react";
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

const TOPIC_ICONS: Record<string, LucideIcon> = {
  "quick-start": Sparkles,
  "guided-tour": Map,
  "keyboard-shortcuts": Keyboard,
  "search-and-filters": Search,
  "global-settings": Settings,
  "reorder-mode": GripVertical,
  saving: Save,
  sharing: Share2,
  "card-variants": Layers,
  "per-card-settings": SlidersHorizontal,
  "bulk-actions": SquareStack,
  "command-palette": Command,
  "color-customization": Palette,
  "settings-templates": Copy,
  "import-export": FileJson,
  "advanced-search": Filter,
  "advanced-card-settings": Settings,
  "copy-download": Download,
};

type IndexedUserHelpTopic = {
  topic: UserHelpTopic;
  searchText: string;
};

function GoldDiamond() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="currentColor"
      className="text-gold/40"
      aria-hidden="true"
    >
      <path d="M5 0L6.5 3.5L10 5L6.5 6.5L5 10L3.5 6.5L0 5L3.5 3.5Z" />
    </svg>
  );
}

function renderBlock(block: UserHelpBlock) {
  switch (block.type) {
    case "p":
      return (
        <p className="font-body-serif text-[0.9rem] leading-[1.7] text-muted-foreground">
          {block.text}
        </p>
      );
    case "note":
      return (
        <div className="relative border-l-2 border-gold/40 bg-gold/4 px-4 py-3 dark:bg-gold/4">
          <span className="font-display text-[0.65rem] tracking-[0.2em] text-gold/70 uppercase">
            Note
          </span>
          <p className="mt-1 font-body-serif text-[0.85rem] leading-[1.65] text-foreground/80">
            {block.text}
          </p>
        </div>
      );
    case "ul":
      return (
        <ul className="space-y-2 pl-0.5">
          {block.items.map((item, idx) => (
            <li
              key={`${idx}-${item}`}
              className="flex items-start gap-3 text-[0.9rem]"
            >
              <span className="mt-[0.55rem] size-1 shrink-0 rounded-full bg-gold/50" />
              <span className="leading-[1.65] text-muted-foreground">
                {item}
              </span>
            </li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol className="space-y-3 pl-0.5">
          {block.items.map((item, idx) => (
            <li
              key={`${idx}-${item}`}
              className="flex items-start gap-3 text-[0.9rem]"
            >
              <span className="
                mt-0.5 flex size-5 shrink-0 items-center justify-center border border-gold/25
                font-display text-[0.65rem] text-gold/80
              ">
                {idx + 1}
              </span>
              <span className="leading-[1.65] text-muted-foreground">
                {item}
              </span>
            </li>
          ))}
        </ol>
      );
    case "link":
      return block.href.startsWith("/") ? (
        <Link
          href={block.href}
          className="
            group inline-flex items-center gap-1.5 font-display text-[0.75rem] tracking-[0.12em]
            text-gold-dim uppercase transition-colors
            hover:text-gold
            dark:text-gold
          "
        >
          {block.label}
          <span className="transition-transform group-hover:translate-x-0.5">
            &rarr;
          </span>
        </Link>
      ) : (
        <a
          href={block.href}
          target="_blank"
          rel="noopener noreferrer"
          className="
            group inline-flex items-center gap-1.5 font-display text-[0.75rem] tracking-[0.12em]
            text-gold-dim uppercase transition-colors
            hover:text-gold
            dark:text-gold
          "
        >
          {block.label}
          <span className="transition-transform group-hover:translate-x-0.5">
            &rarr;
          </span>
        </a>
      );
    default: {
      const _exhaustiveCheck: never = block;
      return _exhaustiveCheck;
    }
  }
}

export function UserHelpDialog({
  open,
  onOpenChange,
  onStartTour,
}: Readonly<UserHelpDialogProps>) {
  const [query, setQuery] = useState("");
  const [selectedTopicId, setSelectedTopicId] = useState<string>(
    USER_HELP_TOPICS[0]?.id ?? "quick-start",
  );

  const indexedTopics = useMemo<IndexedUserHelpTopic[]>(
    () =>
      USER_HELP_TOPICS.map((topic) => ({
        topic,
        searchText: topicToSearchText(topic),
      })),
    [],
  );

  const [fuse, setFuse] = useState<Fuse<IndexedUserHelpTopic> | null>(null);

  useEffect(() => {
    if (!open || fuse) return;

    let cancelled = false;

    void (async () => {
      const { default: Fuse } = await import("fuse.js");
      if (cancelled) return;

      setFuse(
        new Fuse(indexedTopics, {
          includeScore: true,
          threshold: 0.35,
          ignoreLocation: true,
          keys: [
            "topic.title",
            "topic.summary",
            "topic.keywords",
            "searchText",
          ],
        }),
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [fuse, indexedTopics, open]);

  const filteredTopics: UserHelpTopic[] = useMemo(() => {
    const q = query.trim();
    if (!q) return USER_HELP_TOPICS;
    if (!fuse) {
      const normalizedQuery = q.toLowerCase();
      return indexedTopics
        .filter(({ searchText, topic }) => {
          const title = topic.title.toLowerCase();
          const summary = topic.summary.toLowerCase();
          return (
            title.includes(normalizedQuery) ||
            summary.includes(normalizedQuery) ||
            searchText.toLowerCase().includes(normalizedQuery)
          );
        })
        .map(({ topic }) => topic);
    }
    return fuse.search(q).map((r) => r.item.topic);
  }, [fuse, indexedTopics, query]);

  const selectedTopic = useMemo(
    () =>
      filteredTopics.find((t) => t.id === selectedTopicId) ??
      filteredTopics[0] ??
      null,
    [filteredTopics, selectedTopicId],
  );

  const didResetRef = useRef(false);
  const contentRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [selectedTopicId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="
        grid max-h-[88vh] max-w-4xl grid-cols-1 gap-0 overflow-hidden p-0
        md:grid-cols-[230px_1fr]
      ">
        {/* Ambient glow */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-32 -right-32 size-64 rounded-full bg-gold/4 blur-3xl" />
          <div className="absolute -bottom-24 -left-24 size-48 rounded-full bg-gold/3 blur-3xl" />
        </div>

        {/* Desktop sidebar — spans full height */}
        <div className="
          hidden border-r border-gold/10 bg-gold/2
          md:flex md:flex-col
          dark:bg-gold/1.5
        ">
          <div className="shrink-0 px-4 pt-4 pb-2">
            <div className="relative">
              <Search className="absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-gold/40" />
              <input
                id="user-help-search"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search topics..."
                className="
                  h-11 w-full border border-gold/15 bg-transparent pr-3 pl-9 text-sm text-foreground
                  transition-colors
                  placeholder:text-muted-foreground/50
                  focus:border-gold/35 focus:outline-none
                  md:h-9
                "
                aria-label="Search help topics"
              />
            </div>
          </div>

          <nav
            aria-label="Help topics"
            className="min-h-0 flex-1 overflow-y-auto px-2 pb-3"
          >
            {filteredTopics.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground/50 italic">
                No matching topics.
              </p>
            ) : (
              <div className="space-y-px">
                {filteredTopics.map((t) => {
                  const Icon = TOPIC_ICONS[t.id];
                  const isActive = t.id === selectedTopicId;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedTopicId(t.id)}
                      className={cn(
                        `
                          group relative flex w-full items-center gap-3 px-3 py-2.5 text-left
                          transition-all duration-200
                        `,
                        isActive
                          ? "bg-gold/8 dark:bg-gold/8"
                          : "hover:bg-gold/4 dark:hover:bg-gold/4",
                      )}
                      aria-current={isActive ? "page" : undefined}
                    >
                      <div
                        className={cn(
                          `
                            absolute top-1/2 left-0 h-5 w-0.5 -translate-y-1/2 transition-all
                            duration-300
                          `,
                          isActive
                            ? "bg-gold opacity-100"
                            : `
                              bg-transparent opacity-0
                              group-hover:bg-gold/30 group-hover:opacity-100
                            `,
                        )}
                      />

                      {Icon && (
                        <Icon
                          className={cn(
                            "size-4 shrink-0 transition-colors duration-200",
                            isActive
                              ? "text-gold"
                              : "text-muted-foreground/35 group-hover:text-gold/50",
                          )}
                        />
                      )}

                      <span
                        className={cn(
                          "truncate text-sm transition-colors duration-200",
                          isActive
                            ? "font-medium text-foreground"
                            : "text-muted-foreground group-hover:text-foreground/70",
                        )}
                      >
                        {t.title}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </nav>
        </div>

        {/* Right column: header + mobile strip + content + footer */}
        <div className="flex min-h-0 flex-col">
          {/* Header */}
          <div className="relative shrink-0 px-8 pt-7 pb-5">
            <DialogHeader className="border-0 pb-0 text-center">
              <DialogTitle className="text-center text-base tracking-[0.25em] uppercase">
                Imperial Guide
              </DialogTitle>
              <DialogDescription className="
                mx-auto mt-2 max-w-md text-center text-[0.82rem] leading-relaxed
              ">
                Dig through the topics below or search for what you need.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 mb-0 gold-ornament">
              <GoldDiamond />
            </div>
          </div>

          {/* Mobile topic strip */}
          <div className="shrink-0 border-y border-gold/10 px-4 py-3 md:hidden">
            <div className="relative mb-2.5">
              <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-gold/40" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search topics..."
                className="
                  h-11 w-full border border-gold/15 bg-transparent pr-3 pl-8 text-sm text-foreground
                  placeholder:text-muted-foreground/50
                  focus:border-gold/35 focus:outline-none
                "
                aria-label="Search help topics"
              />
            </div>

            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
              {filteredTopics.length === 0 ? (
                <p className="py-1 text-xs text-muted-foreground/50 italic">
                  No results
                </p>
              ) : (
                filteredTopics.map((t) => {
                  const Icon = TOPIC_ICONS[t.id];
                  const isActive = t.id === selectedTopicId;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedTopicId(t.id)}
                      className={cn(
                        `
                          flex min-h-11 shrink-0 items-center gap-1.5 rounded-md border px-3.5 py-2
                          text-xs transition-all
                        `,
                        isActive
                          ? "border-gold/35 bg-gold/10 text-foreground"
                          : `
                            border-gold/10 text-muted-foreground
                            hover:border-gold/25 hover:bg-gold/5
                          `,
                      )}
                    >
                      {Icon && <Icon className="size-3" />}
                      {t.title}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Content panel */}
          <div ref={contentRef} className="min-h-0 flex-1 overflow-y-auto">
            {selectedTopic ? (
              <article
                aria-label={selectedTopic.title}
                key={selectedTopic.id}
                className="animate-in p-6 duration-200 fade-in md:px-8"
              >
                <header className="mb-5">
                  <div className="flex items-center gap-3.5">
                    {(() => {
                      const Icon = TOPIC_ICONS[selectedTopic.id];
                      if (!Icon) return null;
                      return (
                        <div className="
                          flex size-9 shrink-0 items-center justify-center border border-gold/20
                          bg-gold/5
                        ">
                          <Icon className="size-5 text-gold" />
                        </div>
                      );
                    })()}
                    <div>
                      <h3 className="
                        font-display text-[0.95rem] leading-tight tracking-[0.18em] text-foreground
                        uppercase
                      ">
                        {selectedTopic.title}
                      </h3>
                      <p className="
                        mt-0.5 font-body-serif text-[0.78rem] text-muted-foreground/60 italic
                      ">
                        {selectedTopic.summary}
                      </p>
                    </div>
                  </div>
                  <div className="gold-line mt-4" />
                </header>

                <div className="space-y-4">
                  {selectedTopic.blocks.map((block, idx) => (
                    <div key={`${selectedTopic.id}-${idx}`}>
                      {renderBlock(block)}
                    </div>
                  ))}
                </div>
              </article>
            ) : (
              <div className="flex h-full items-center justify-center py-20">
                <p className="font-body-serif text-sm text-muted-foreground/40 italic">
                  Pick a topic from the sidebar to get started.
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="relative shrink-0 border-t border-gold/15 px-6 py-3.5 md:px-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="font-mono text-[0.68rem] tracking-wide text-muted-foreground/45">
                <kbd className="text-gold/50">Ctrl/Cmd + H</kbd> to toggle
              </span>

              <div className="flex items-center gap-2">
                {onStartTour && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="
                      h-8 rounded-none border border-gold/20 px-4 font-display text-[0.68rem]
                      tracking-[0.12em] uppercase transition-all
                      hover:border-gold/40 hover:bg-gold/8
                    "
                    onClick={onStartTour}
                  >
                    Start Tour
                  </Button>
                )}

                <Button
                  variant="ghost"
                  className="
                    h-8 rounded-none border border-gold/20 px-4 font-display text-[0.68rem]
                    tracking-[0.12em] uppercase transition-all
                    hover:border-gold/40 hover:bg-gold/8
                  "
                  asChild
                >
                  <Link href="/examples">Examples</Link>
                </Button>

                <DialogClose asChild>
                  <Button
                    type="button"
                    className="
                      h-8 rounded-none border border-gold/30 bg-gold/10 px-5 font-display
                      text-[0.68rem] tracking-[0.12em] text-foreground uppercase transition-all
                      hover:bg-gold/18
                    "
                  >
                    Close
                  </Button>
                </DialogClose>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
