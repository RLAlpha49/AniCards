"use client";

import Fuse from "fuse.js";
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
        <p className="font-body-serif text-muted-foreground text-[0.9rem] leading-[1.7]">
          {block.text}
        </p>
      );
    case "note":
      return (
        <div className="border-gold/40 bg-gold/4 dark:bg-gold/4 relative border-l-2 py-3 pr-4 pl-4">
          <span className="font-display text-gold/70 text-[0.65rem] tracking-[0.2em] uppercase">
            Note
          </span>
          <p className="font-body-serif text-foreground/80 mt-1 text-[0.85rem] leading-[1.65]">
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
              <span className="bg-gold/50 mt-[0.55rem] h-1 w-1 shrink-0 rounded-full" />
              <span className="text-muted-foreground leading-[1.65]">
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
              <span className="font-display text-gold/80 border-gold/25 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border text-[0.65rem]">
                {idx + 1}
              </span>
              <span className="text-muted-foreground leading-[1.65]">
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
          className="font-display text-gold-dim dark:text-gold group hover:text-gold inline-flex items-center gap-1.5 text-[0.75rem] tracking-[0.12em] uppercase transition-colors"
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
          className="font-display text-gold-dim dark:text-gold group hover:text-gold inline-flex items-center gap-1.5 text-[0.75rem] tracking-[0.12em] uppercase transition-colors"
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
      <DialogContent className="grid max-h-[88vh] max-w-4xl grid-cols-1 gap-0 overflow-hidden p-0 md:grid-cols-[230px_1fr]">
        {/* Ambient glow */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="bg-gold/4 absolute -top-32 -right-32 h-64 w-64 rounded-full blur-3xl" />
          <div className="bg-gold/3 absolute -bottom-24 -left-24 h-48 w-48 rounded-full blur-3xl" />
        </div>

        {/* Desktop sidebar — spans full height */}
        <div className="border-gold/10 bg-gold/2 dark:bg-gold/1.5 hidden border-r md:flex md:flex-col">
          <div className="shrink-0 px-4 pt-4 pb-2">
            <div className="relative">
              <Search className="text-gold/40 absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2" />
              <input
                id="user-help-search"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search topics..."
                className="border-gold/15 text-foreground placeholder:text-muted-foreground/50 focus:border-gold/35 h-9 w-full border bg-transparent pr-3 pl-9 text-sm transition-colors focus:outline-none"
                aria-label="Search help topics"
              />
            </div>
          </div>

          <nav
            aria-label="Help topics"
            className="overlay-scrollbar min-h-0 flex-1 overflow-y-auto px-2 pb-3"
          >
            {filteredTopics.length === 0 ? (
              <p className="text-muted-foreground/50 px-3 py-6 text-center text-xs italic">
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
                        "group relative flex w-full items-center gap-3 px-3 py-2.5 text-left transition-all duration-200",
                        isActive
                          ? "bg-gold/8 dark:bg-gold/8"
                          : "hover:bg-gold/4 dark:hover:bg-gold/4",
                      )}
                      aria-current={isActive ? "page" : undefined}
                    >
                      <div
                        className={cn(
                          "absolute top-1/2 left-0 h-5 w-0.5 -translate-y-1/2 transition-all duration-300",
                          isActive
                            ? "bg-gold opacity-100"
                            : "group-hover:bg-gold/30 bg-transparent opacity-0 group-hover:opacity-100",
                        )}
                      />

                      {Icon && (
                        <Icon
                          className={cn(
                            "h-4 w-4 shrink-0 transition-colors duration-200",
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
                            ? "text-foreground font-medium"
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
              <DialogDescription className="mx-auto mt-2 max-w-md text-center text-[0.82rem] leading-relaxed">
                Dig through the topics below or search for what you need.
              </DialogDescription>
            </DialogHeader>

            <div className="gold-ornament mt-4 mb-0">
              <GoldDiamond />
            </div>
          </div>

          {/* Mobile topic strip */}
          <div className="border-gold/10 shrink-0 border-y px-4 py-3 md:hidden">
            <div className="relative mb-2.5">
              <Search className="text-gold/40 absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search topics..."
                className="border-gold/15 text-foreground placeholder:text-muted-foreground/50 focus:border-gold/35 h-8 w-full border bg-transparent pr-3 pl-8 text-sm focus:outline-none"
                aria-label="Search help topics"
              />
            </div>

            <div className="overlay-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
              {filteredTopics.length === 0 ? (
                <p className="text-muted-foreground/50 py-1 text-xs italic">
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
                        "flex shrink-0 items-center gap-1.5 border px-3 py-1.5 text-xs transition-all",
                        isActive
                          ? "border-gold/35 bg-gold/10 text-foreground"
                          : "border-gold/10 text-muted-foreground hover:border-gold/25 hover:bg-gold/5",
                      )}
                    >
                      {Icon && <Icon className="h-3 w-3" />}
                      {t.title}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Content panel */}
          <div
            ref={contentRef}
            className="overlay-scrollbar min-h-0 flex-1 overflow-y-auto"
          >
            {selectedTopic ? (
              <article
                aria-label={selectedTopic.title}
                key={selectedTopic.id}
                className="animate-in fade-in px-6 py-6 duration-200 md:px-8"
              >
                <header className="mb-5">
                  <div className="flex items-center gap-3.5">
                    {(() => {
                      const Icon = TOPIC_ICONS[selectedTopic.id];
                      if (!Icon) return null;
                      return (
                        <div className="border-gold/20 bg-gold/5 flex h-9 w-9 shrink-0 items-center justify-center border">
                          <Icon className="text-gold h-5 w-5" />
                        </div>
                      );
                    })()}
                    <div>
                      <h3 className="font-display text-foreground text-[0.95rem] leading-tight tracking-[0.18em] uppercase">
                        {selectedTopic.title}
                      </h3>
                      <p className="font-body-serif text-muted-foreground/60 mt-0.5 text-[0.78rem] italic">
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
                <p className="font-body-serif text-muted-foreground/40 text-sm italic">
                  Pick a topic from the sidebar to get started.
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-gold/15 relative shrink-0 border-t px-6 py-3.5 md:px-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-muted-foreground/45 font-mono text-[0.68rem] tracking-wide">
                <kbd className="text-gold/50">Ctrl/Cmd + H</kbd> to toggle
              </span>

              <div className="flex items-center gap-2">
                {onStartTour && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="font-display border-gold/20 hover:border-gold/40 hover:bg-gold/8 h-8 rounded-none border px-4 text-[0.68rem] tracking-[0.12em] uppercase transition-all"
                    onClick={onStartTour}
                  >
                    Start Tour
                  </Button>
                )}

                <Button
                  variant="ghost"
                  className="font-display border-gold/20 hover:border-gold/40 hover:bg-gold/8 h-8 rounded-none border px-4 text-[0.68rem] tracking-[0.12em] uppercase transition-all"
                  asChild
                >
                  <Link href="/examples">Examples</Link>
                </Button>

                <DialogClose asChild>
                  <Button
                    type="button"
                    className="font-display border-gold/30 bg-gold/10 text-foreground hover:bg-gold/18 h-8 rounded-none border px-5 text-[0.68rem] tracking-[0.12em] uppercase transition-all"
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
