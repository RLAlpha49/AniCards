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
    // Ignore non-primary buttons and disabled commands
    if (cmd.disabled || e.button !== 0) return;
    // Prevent the input from blurring and stealing focus which can stop
    // the click from being processed by cmdk in some browsers.
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
        "flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm",
        "text-foreground aria-selected:bg-gold/10",
        "dark:text-foreground dark:aria-selected:bg-gold/10",
        "data-disabled:pointer-events-none data-disabled:opacity-50",
      )}
    >
      <span className="border-gold/20 bg-gold/10 text-gold-dim dark:border-gold/15 dark:bg-gold/10 dark:text-gold inline-flex h-7 w-7 items-center justify-center border">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{cmd.label}</div>
        {cmd.description ? (
          <div className="text-muted-foreground truncate text-xs">
            {cmd.description}
          </div>
        ) : null}
      </div>
      {cmd.shortcutHint ? (
        <span className="text-muted-foreground ml-2 text-[10px]">
          {cmd.shortcutHint}
        </span>
      ) : null}
    </Command.Item>
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

  // Keep selection in sync with the current search query. When the user types a
  // query which removes the currently-selected item, pick the first visible
  // matching item so Enter still works without needing to arrow-key first.
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

      // Run after the dialog begins closing to avoid nested-dialog focus issues
      // when a command opens another dialog.
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
        className={cn(
          "p-0",
          "max-w-180",
          "overflow-hidden",
          "border-gold/15 bg-background dark:border-gold/10",
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
          <div className="border-gold/15 dark:border-gold/10 flex items-center gap-2 border-b px-3 py-2">
            <Search
              className="text-muted-foreground h-4 w-4"
              aria-hidden="true"
            />
            <Command.Input
              value={search}
              onValueChange={setSearch}
              placeholder="Type a command or search…"
              aria-label="Command palette"
              className={cn(
                "flex h-10 w-full bg-transparent text-sm outline-none",
                "text-foreground placeholder:text-muted-foreground",
                "dark:text-foreground dark:placeholder:text-muted-foreground",
              )}
            />
            <kbd className="border-gold/20 bg-gold/5 text-gold-dim dark:border-gold/15 dark:bg-gold/5 dark:text-gold hidden rounded-md border px-1.5 py-0.5 text-[10px] sm:inline-flex">
              Esc
            </kbd>
          </div>

          <Command.List className="max-h-[60vh] overflow-y-auto p-2">
            <Command.Empty className="text-muted-foreground px-3 py-8 text-center text-sm">
              No results.
            </Command.Empty>

            {recentCommands.length > 0 && search.trim().length === 0 && (
              <Command.Group heading="Recent" className="px-1 py-1">
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
              <Command.Group heading="Editor" className="px-1 py-1">
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
              <Command.Group heading="Bulk" className="px-1 py-1">
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
              <Command.Group heading="Help" className="px-1 py-1">
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
        </Command>
      </DialogContent>
    </Dialog>
  );
}
