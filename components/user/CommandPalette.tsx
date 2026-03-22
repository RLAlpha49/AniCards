"use client";

import { Command } from "cmdk";
import { Info, Layers, Search, Sparkles } from "lucide-react";
import * as React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/Dialog";
import { cn } from "@/lib/utils";

export type CommandPaletteCommand = {
  id: string;
  label: string;
  description?: string;
  /** Additional fuzzy match keywords (beyond label/description). */
  keywords?: string[];
  /** Rendered at left of the item. */
  icon?: React.ReactNode;
  /** Small UI hint shown at right (e.g., Ctrl+S). */
  shortcutHint?: string;
  disabled?: boolean;
  /** Invoked when the command is selected. */
  run: () => void | Promise<void>;
  group: "editor" | "bulk" | "help";
};

type RecentAction = {
  id: string;
  label: string;
  at: number;
};

function isNonNullable<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function readRecentActions(storageKey: string): RecentAction[] {
  if (globalThis.window === undefined) return [];

  try {
    const raw = globalThis.window.localStorage.getItem(storageKey);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(
        (v): v is RecentAction =>
          Boolean(v) &&
          typeof v === "object" &&
          typeof (v as RecentAction).id === "string" &&
          typeof (v as RecentAction).label === "string" &&
          typeof (v as RecentAction).at === "number",
      )
      .slice(0, 8);
  } catch {
    return [];
  }
}

function writeRecentActions(storageKey: string, actions: RecentAction[]) {
  if (globalThis.window === undefined) return;

  try {
    globalThis.window.localStorage.setItem(storageKey, JSON.stringify(actions));
  } catch {
    // Ignore persistence errors (private mode/quota/etc)
  }
}

function defaultIconForGroup(group: CommandPaletteCommand["group"]) {
  switch (group) {
    case "editor":
      return <Search className="h-4 w-4" aria-hidden="true" />;
    case "bulk":
      return <Layers className="h-4 w-4" aria-hidden="true" />;
    case "help":
      return <Info className="h-4 w-4" aria-hidden="true" />;
    default:
      return <Search className="h-4 w-4" aria-hidden="true" />;
  }
}

function ShortcutBadge({ hint }: Readonly<{ hint: string }>) {
  const keys = hint.split("+").map((k) => k.trim());
  return (
    <span className="ml-auto flex shrink-0 items-center gap-0.5 pl-3">
      {keys.map((key, i) => (
        <React.Fragment key={key}>
          {i > 0 && (
            <span className="text-muted-foreground/40 text-[9px]">+</span>
          )}
          <kbd
            className={cn(
              "inline-flex h-5 min-w-5 items-center justify-center px-1",
              "border-gold/15 bg-gold/5 border text-[10px] font-semibold",
              "text-gold-dim/70 dark:border-gold/10 dark:bg-gold/5 dark:text-gold/50",
              "shadow-[inset_0_-1px_0_hsl(var(--gold)/0.08)]",
            )}
          >
            {key}
          </kbd>
        </React.Fragment>
      ))}
    </span>
  );
}

function CommandItem({
  cmd,
  icon,
  onSelect,
}: Readonly<{
  cmd: CommandPaletteCommand;
  icon: React.ReactNode;
  onSelect: (cmd: CommandPaletteCommand) => void;
}>) {
  const handlePointerDown = (e: React.PointerEvent) => {
    if (cmd.disabled || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    onSelect(cmd);
  };

  return (
    <Command.Item
      value={cmd.label}
      keywords={cmd.keywords}
      disabled={cmd.disabled}
      onSelect={() => onSelect(cmd)}
      onPointerDown={handlePointerDown}
      className={cn(
        "group/cmd relative mx-1 flex cursor-pointer items-center gap-3 px-3 py-2.5",
        "text-foreground transition-all duration-150",
        "aria-selected:bg-gold/[0.07] aria-selected:shadow-[inset_3px_0_0_hsl(var(--gold)/0.6)]",
        "dark:aria-selected:bg-gold/5 dark:aria-selected:shadow-[inset_3px_0_0_hsl(var(--gold)/0.5)]",
        "data-disabled:pointer-events-none data-disabled:opacity-40",
      )}
    >
      <span
        className={cn(
          "relative flex h-8 w-8 shrink-0 items-center justify-center",
          "border-gold/15 from-gold/10 to-gold/4 border bg-linear-to-br",
          "text-gold-dim dark:border-gold/10 dark:from-gold/10 dark:to-gold/4 dark:text-gold/80",
          "transition-colors duration-150",
          "group-aria-selected/cmd:border-gold/25 group-aria-selected/cmd:from-gold/15 group-aria-selected/cmd:to-gold/6",
        )}
      >
        {icon}
      </span>

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm leading-tight font-medium">
          {cmd.label}
        </div>
        {cmd.description ? (
          <div className="text-muted-foreground mt-0.5 truncate text-xs leading-tight">
            {cmd.description}
          </div>
        ) : null}
      </div>

      {cmd.shortcutHint ? <ShortcutBadge hint={cmd.shortcutHint} /> : null}
    </Command.Item>
  );
}

function PaletteFooter() {
  return (
    <div
      className={cn(
        "border-gold/10 dark:border-gold/6 flex items-center gap-5 border-t px-4 py-2",
        "text-muted-foreground/50 text-[11px] select-none",
      )}
    >
      <span className="flex items-center gap-1.5">
        <kbd className="inline-flex h-4.5 w-4.5 items-center justify-center border border-current/20 text-[9px]">
          ↑
        </kbd>
        <kbd className="inline-flex h-4.5 w-4.5 items-center justify-center border border-current/20 text-[9px]">
          ↓
        </kbd>
        <span className="ml-0.5">Navigate</span>
      </span>
      <span className="flex items-center gap-1.5">
        <kbd className="inline-flex h-4.5 min-w-4.5 items-center justify-center border border-current/20 px-1 text-[9px]">
          ↵
        </kbd>
        <span>Run</span>
      </span>
      <span className="flex items-center gap-1.5">
        <kbd className="inline-flex h-4.5 min-w-4.5 items-center justify-center border border-current/20 px-1 text-[9px]">
          Esc
        </kbd>
        <span>Close</span>
      </span>
      <div className="from-gold/20 via-gold/5 ml-auto h-px w-16 bg-linear-to-r to-transparent" />
    </div>
  );
}

export type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commands: CommandPaletteCommand[];
  /** Used to scope localStorage history. */
  recentStorageKey: string;
  className?: string;
};

export function CommandPalette({
  open,
  onOpenChange,
  commands,
  recentStorageKey,
  className,
}: Readonly<CommandPaletteProps>) {
  const [search, setSearch] = React.useState("");
  const [recent, setRecent] = React.useState<RecentAction[]>([]);
  const [selectedValue, setSelectedValue] = React.useState<string | undefined>(
    undefined,
  );

  const commandById = React.useMemo(() => {
    const map = new Map<string, CommandPaletteCommand>();
    for (const cmd of commands) map.set(cmd.id, cmd);
    return map;
  }, [commands]);

  React.useEffect(() => {
    if (!open) return;

    setSearch("");
    setRecent(readRecentActions(recentStorageKey));
    setSelectedValue(undefined);
  }, [open, recentStorageKey]);

  React.useEffect(() => {
    const q = search.trim().toLowerCase();
    if (!q) {
      setSelectedValue(undefined);
      return;
    }

    const match = commands.find((cmd) => {
      if (cmd.disabled) return false;
      if (cmd.label.toLowerCase().includes(q)) return true;
      if (cmd.description?.toLowerCase().includes(q)) return true;
      if (cmd.keywords?.some((k) => k.toLowerCase().includes(q))) return true;
      return false;
    });

    setSelectedValue(match?.label);
  }, [search, commands]);

  const pushRecent = React.useCallback(
    (cmd: CommandPaletteCommand) => {
      setRecent((prev) => {
        const next: RecentAction[] = [
          { id: cmd.id, label: cmd.label, at: Date.now() },
          ...prev.filter((r) => r.id !== cmd.id),
        ].slice(0, 8);

        writeRecentActions(recentStorageKey, next);
        return next;
      });
    },
    [recentStorageKey],
  );

  const runCommand = React.useCallback(
    (cmd: CommandPaletteCommand) => {
      if (cmd.disabled) return;

      onOpenChange(false);
      pushRecent(cmd);

      globalThis.setTimeout(() => {
        Promise.resolve()
          .then(() => cmd.run())
          .catch((err) => console.error("Command execution failed:", err));
      }, 0);
    },
    [onOpenChange, pushRecent],
  );

  const recentCommands = React.useMemo(() => {
    const idsInOrder = recent
      .map((r) => r.id)
      .filter((id) => commandById.has(id));

    return idsInOrder
      .map((id) => commandById.get(id))
      .filter(isNonNullable)
      .slice(0, 6);
  }, [commandById, recent]);

  const grouped = React.useMemo(() => {
    const editor: CommandPaletteCommand[] = [];
    const bulk: CommandPaletteCommand[] = [];
    const help: CommandPaletteCommand[] = [];

    for (const cmd of commands) {
      if (cmd.group === "editor") editor.push(cmd);
      else if (cmd.group === "bulk") bulk.push(cmd);
      else if (cmd.group === "help") help.push(cmd);
    }

    return { editor, bulk, help };
  }, [commands]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideCloseButton
        className={cn(
          "cmd-palette-panel overflow-hidden p-0",
          "max-w-xl sm:max-w-2xl",
          "border-gold/20 dark:border-gold/12",
          "shadow-[0_32px_100px_-16px_hsl(var(--gold)/0.15),0_12px_36px_-8px_hsl(0_0%_0%/0.3)]",
          "dark:shadow-[0_32px_100px_-16px_hsl(var(--gold)/0.08),0_12px_36px_-8px_hsl(0_0%_0%/0.5)]",
          className,
        )}
      >
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <DialogDescription className="sr-only">
          Type to search commands. Use arrow keys to navigate and Enter to run.
        </DialogDescription>

        <Command
          value={selectedValue}
          onValueChange={setSelectedValue}
          className="flex h-full w-full flex-col"
        >
          {/* ── Search header ── */}
          <div className="cmd-search-area relative px-4 pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="text-gold/50 dark:text-gold/40">
                <Search className="h-5 w-5" aria-hidden="true" />
              </div>
              <Command.Input
                value={search}
                onValueChange={setSearch}
                placeholder="Type a command or search…"
                aria-label="Command palette"
                className={cn(
                  "flex h-10 w-full bg-transparent text-[15px] font-medium outline-none",
                  "text-foreground placeholder:text-muted-foreground/50",
                  "dark:text-foreground dark:placeholder:text-muted-foreground/40",
                )}
              />
              <kbd
                className={cn(
                  "hidden shrink-0 items-center border px-2 py-1 text-[10px] font-semibold sm:inline-flex",
                  "border-gold/20 bg-gold/5 text-gold-dim/70",
                  "dark:border-gold/12 dark:bg-gold/4 dark:text-gold/45",
                )}
              >
                ESC
              </kbd>
            </div>
          </div>

          {/* ── Results ── */}
          <Command.List className="cmd-palette-list max-h-[min(60vh,420px)] overflow-y-auto px-2 pb-2">
            <Command.Empty className="flex flex-col items-center justify-center gap-2 px-4 py-14">
              <div className="text-muted-foreground/20 flex h-12 w-12 items-center justify-center border border-current/20">
                <Search className="h-5 w-5" aria-hidden="true" />
              </div>
              <p className="text-muted-foreground/40 text-sm font-medium">
                No matching commands
              </p>
              <p className="text-muted-foreground/25 text-xs">
                Try a different search term
              </p>
            </Command.Empty>

            {recentCommands.length > 0 && search.trim().length === 0 && (
              <Command.Group heading="Recent">
                {recentCommands.map((cmd) => (
                  <CommandItem
                    key={cmd.id}
                    cmd={cmd}
                    icon={<Sparkles className="h-4 w-4" aria-hidden="true" />}
                    onSelect={runCommand}
                  />
                ))}
              </Command.Group>
            )}

            {grouped.editor.length > 0 && (
              <Command.Group heading="Editor">
                {grouped.editor.map((cmd) => (
                  <CommandItem
                    key={cmd.id}
                    cmd={cmd}
                    icon={cmd.icon ?? defaultIconForGroup(cmd.group)}
                    onSelect={runCommand}
                  />
                ))}
              </Command.Group>
            )}

            {grouped.bulk.length > 0 && (
              <Command.Group heading="Bulk Operations">
                {grouped.bulk.map((cmd) => (
                  <CommandItem
                    key={cmd.id}
                    cmd={cmd}
                    icon={cmd.icon ?? defaultIconForGroup(cmd.group)}
                    onSelect={runCommand}
                  />
                ))}
              </Command.Group>
            )}

            {grouped.help.length > 0 && (
              <Command.Group heading="Help & Guides">
                {grouped.help.map((cmd) => (
                  <CommandItem
                    key={cmd.id}
                    cmd={cmd}
                    icon={cmd.icon ?? defaultIconForGroup(cmd.group)}
                    onSelect={runCommand}
                  />
                ))}
              </Command.Group>
            )}
          </Command.List>

          {/* ── Footer ── */}
          <PaletteFooter />
        </Command>
      </DialogContent>
    </Dialog>
  );
}
