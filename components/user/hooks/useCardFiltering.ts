// Centralizes card search, filter tokens, grouping, and expand/collapse state
// so the editor can treat filtering as one derived view model instead of
// recomputing pieces across multiple components.

import type Fuse from "fuse.js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { statCardTypes } from "@/lib/card-types";

type ParsedCardSearchQuery = {
  /** Free text (non token) portion of the query, normalized to lower-case. */
  text: string;
  /** Optional group filter terms. A card matches if its group contains any term. */
  groupTerms: string[];
  /** Optional enabled filter derived from tokens like enabled:true/status:disabled. */
  enabled: boolean | null;
  /** Optional customization filter derived from tokens like custom:yes. */
  custom: boolean | null;
};

export type { ParsedCardSearchQuery };

export function tokenizeQuery(input: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let inQuotes = false;

  for (const ch of input) {
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (!inQuotes && /\s/.test(ch)) {
      const trimmed = current.trim();
      if (trimmed) tokens.push(trimmed);
      current = "";
      continue;
    }

    current += ch;
  }

  const final = current.trim();
  if (final) tokens.push(final);
  return tokens;
}

function splitKeyValueToken(
  token: string,
): { key: string; value: string } | null {
  const colonIndex = token.indexOf(":");
  if (colonIndex <= 0) return null;
  const key = token.slice(0, colonIndex).trim().toLowerCase();
  const value = token.slice(colonIndex + 1).trim();
  if (!key) return null;
  return { key, value };
}

function parseBooleanTokenValue(value: string): boolean | null {
  const v = value.trim().toLowerCase();
  if (!v) return null;
  if (["true", "t", "yes", "y", "1", "on", "enabled", "enable"].includes(v))
    return true;
  if (["false", "f", "no", "n", "0", "off", "disabled", "disable"].includes(v))
    return false;
  return null;
}

export function parseCardSearchQuery(raw: string): ParsedCardSearchQuery {
  const tokens = tokenizeQuery(raw);

  const freeTextParts: string[] = [];
  const groupTerms: string[] = [];
  let enabled: boolean | null = null;
  let custom: boolean | null = null;

  for (const token of tokens) {
    const kv = splitKeyValueToken(token);
    if (!kv) {
      freeTextParts.push(token);
      continue;
    }

    // Treat empty-value tokens as free text to avoid surprising behavior.
    if (!kv.value) {
      freeTextParts.push(token);
      continue;
    }

    switch (kv.key) {
      case "group":
      case "g": {
        groupTerms.push(kv.value.toLowerCase());
        break;
      }

      case "enabled":
      case "status": {
        const parsed = parseBooleanTokenValue(kv.value);
        if (parsed !== null) enabled = parsed;
        break;
      }

      case "custom":
      case "customized":
      case "customised": {
        const parsed = parseBooleanTokenValue(kv.value);
        if (parsed !== null) custom = parsed;
        break;
      }

      default:
        // Unknown token: keep it as free text to avoid surprising behavior.
        freeTextParts.push(token);
        break;
    }
  }

  return {
    text: freeTextParts.join(" ").trim().toLowerCase(),
    groupTerms,
    enabled,
    custom,
  };
}

function groupCardsByCategory() {
  const groups: Record<string, Array<(typeof statCardTypes)[0]>> = {};

  for (const cardType of statCardTypes) {
    if (!groups[cardType.group]) groups[cardType.group] = [];
    groups[cardType.group].push(cardType);
  }

  return groups;
}

const CARD_GROUPS = groupCardsByCategory();
const DEFAULT_CARD_ORDER = statCardTypes.map((t) => t.id);
const ALL_GROUP_NAMES = Object.keys(CARD_GROUPS);
const CARD_SEARCH_TEXT_BY_ID = new Map<string, string>(
  statCardTypes.map((t) => {
    const variationText = t.variations.map((v) => v.label).join(" ");
    return [
      t.id,
      `${t.label} ${t.id} ${t.group} ${variationText}`.toLowerCase(),
    ] as const;
  }),
);

type IndexedCardSearchItem = {
  id: string;
  label: string;
  group: string;
  variationLabels: string;
};

const CARD_SEARCH_INDEX_ITEMS: IndexedCardSearchItem[] = statCardTypes.map(
  (t) => ({
    id: t.id,
    label: t.label,
    group: t.group,
    variationLabels: t.variations.map((v) => v.label).join(" "),
  }),
);

let cachedCardSearchFuse: Fuse<IndexedCardSearchItem> | null = null;
let cardSearchFusePromise: Promise<Fuse<IndexedCardSearchItem>> | null = null;

function loadCardSearchFuse(): Promise<Fuse<IndexedCardSearchItem>> {
  if (cachedCardSearchFuse) {
    return Promise.resolve(cachedCardSearchFuse);
  }

  cardSearchFusePromise ??= import("fuse.js")
    .then(({ default: Fuse }) => {
      const fuse = new Fuse<IndexedCardSearchItem>(CARD_SEARCH_INDEX_ITEMS, {
        keys: ["label", "id", "group", "variationLabels"],
        threshold: 0.35,
        ignoreLocation: true,
      });

      cachedCardSearchFuse = fuse;
      return fuse;
    })
    .catch((error: unknown) => {
      cardSearchFusePromise = null;
      throw error;
    });

  return cardSearchFusePromise;
}

export function prefetchCardFilteringFuzzySearch(): void {
  void loadCardSearchFuse();
}

export type CustomFilter = "all" | "customized" | "uncustomized";

const VALID_CUSTOM_FILTERS = new Set<CustomFilter>([
  "all",
  "customized",
  "uncustomized",
]);

export function parseCustomFilterParam(
  value: string | null | undefined,
): CustomFilter {
  return value && VALID_CUSTOM_FILTERS.has(value as CustomFilter)
    ? (value as CustomFilter)
    : "all";
}

export function summarizeCardFilters(params: {
  query: string;
  visibility: "all" | "enabled" | "disabled";
  selectedGroup: string;
  customFilter?: CustomFilter;
}): {
  activeFilterCount: number;
  hasActiveFilters: boolean;
} {
  const activeFilterCount =
    Number(params.query.trim().length > 0) +
    Number(params.visibility !== "all") +
    Number(params.selectedGroup !== "All") +
    Number((params.customFilter ?? "all") !== "all");

  return {
    activeFilterCount,
    hasActiveFilters: activeFilterCount > 0,
  };
}

function filterCardsInGroup(
  cards: ReadonlyArray<(typeof statCardTypes)[0]>,
  matchesVisibility: (cardId: string) => boolean,
  matchesQuery: (cardType: (typeof statCardTypes)[0]) => boolean,
  cardEnabledById: Record<string, boolean | undefined>,
): {
  filtered: Array<(typeof statCardTypes)[0]>;
  enabledCount: number;
  scopeCount: number;
} {
  const filtered: Array<(typeof statCardTypes)[0]> = [];
  let enabledCount = 0;
  let scopeCount = 0;

  for (const cardType of cards) {
    if (!matchesVisibility(cardType.id)) continue;
    scopeCount += 1;

    if (!matchesQuery(cardType)) continue;
    filtered.push(cardType);
    if (cardEnabledById[cardType.id]) enabledCount += 1;
  }

  return { filtered, enabledCount, scopeCount };
}

export function useCardFiltering({
  cardEnabledById,
  cardCustomizedById,
  cardOrder,
  query,
  visibility,
  selectedGroup,
  customFilter,
  fuzzy = true,
}: {
  cardEnabledById: Record<string, boolean | undefined>;
  cardCustomizedById?: Record<string, boolean | undefined>;
  cardOrder?: readonly string[];
  query: string;
  visibility: "all" | "enabled" | "disabled";
  selectedGroup: string;
  customFilter?: CustomFilter;
  fuzzy?: boolean;
}) {
  const [fuse, setFuse] = useState<Fuse<IndexedCardSearchItem> | null>(
    cachedCardSearchFuse,
  );

  const orderIndexById = useMemo(() => {
    const map = new Map<string, number>();
    const order =
      Array.isArray(cardOrder) && cardOrder.length > 0
        ? cardOrder
        : DEFAULT_CARD_ORDER;
    for (let i = 0; i < order.length; i++) {
      map.set(order[i], i);
    }
    return map;
  }, [cardOrder]);

  const { activeFilterCount, hasActiveFilters } = useMemo(
    () =>
      summarizeCardFilters({
        query,
        visibility,
        selectedGroup,
        customFilter,
      }),
    [customFilter, query, selectedGroup, visibility],
  );

  const cardGroups = useMemo(() => {
    // Keep the same category grouping, but sort within each category based on cardOrder.
    const next: Record<string, Array<(typeof statCardTypes)[0]>> = {};
    for (const [groupName, cards] of Object.entries(CARD_GROUPS)) {
      next[groupName] = [...cards].sort((a, b) => {
        const ai = orderIndexById.get(a.id) ?? Number.MAX_SAFE_INTEGER;
        const bi = orderIndexById.get(b.id) ?? Number.MAX_SAFE_INTEGER;
        return ai - bi;
      });
    }
    return next;
  }, [orderIndexById]);

  const normalizedQuery = useMemo(() => query.trim().toLowerCase(), [query]);
  const parsedQuery = useMemo(() => parseCardSearchQuery(query), [query]);

  const effectiveCustomFilter = useMemo<CustomFilter>(() => {
    if (typeof customFilter === "string" && customFilter !== "all")
      return customFilter;
    if (parsedQuery.custom === true) return "customized";
    if (parsedQuery.custom === false) return "uncustomized";
    return "all";
  }, [customFilter, parsedQuery.custom]);

  const isCardEnabled = useCallback(
    (cardId: string) => Boolean(cardEnabledById[cardId]),
    [cardEnabledById],
  );

  const groupTotals = useMemo(() => {
    const map: Record<string, { total: number; enabled: number }> = {};
    for (const [groupName, cards] of Object.entries(cardGroups)) {
      const enabledCount = cards.reduce(
        (acc, c) => acc + (cardEnabledById[c.id] ? 1 : 0),
        0,
      );
      map[groupName] = { total: cards.length, enabled: enabledCount };
    }
    return map;
  }, [cardEnabledById, cardGroups]);

  useEffect(() => {
    if (!fuzzy || !parsedQuery.text || fuse) return;

    let cancelled = false;

    void loadCardSearchFuse().then((loadedFuse) => {
      if (cancelled) return;
      setFuse(loadedFuse);
    });

    return () => {
      cancelled = true;
    };
  }, [fuse, fuzzy, parsedQuery.text]);

  const fuzzyMatchIds = useMemo(() => {
    if (!parsedQuery.text || !fuse) return null;
    const results = fuse.search(parsedQuery.text);
    return new Set(results.map((r) => r.item.id));
  }, [parsedQuery.text, fuse]);

  const matchesVisibility = useCallback(
    (cardId: string) => {
      const enabled = Boolean(cardEnabledById[cardId]);
      if (visibility === "enabled") return enabled;
      if (visibility === "disabled") return !enabled;
      return true;
    },
    [cardEnabledById, visibility],
  );

  const matchesQuery = useCallback(
    (cardType: (typeof statCardTypes)[0]) => {
      if (parsedQuery.groupTerms.length > 0) {
        const group = cardType.group.toLowerCase();
        const matchesAnyGroup = parsedQuery.groupTerms.some((t) =>
          group.includes(t),
        );
        if (!matchesAnyGroup) return false;
      }

      if (parsedQuery.enabled !== null) {
        const enabled = Boolean(cardEnabledById[cardType.id]);
        if (enabled !== parsedQuery.enabled) return false;
      }

      if (effectiveCustomFilter !== "all") {
        const customized = Boolean(cardCustomizedById?.[cardType.id]);
        if (effectiveCustomFilter === "customized" && !customized) return false;
        if (effectiveCustomFilter === "uncustomized" && customized)
          return false;
      }

      if (!parsedQuery.text) return true;
      if (fuzzyMatchIds) return fuzzyMatchIds.has(cardType.id);
      const haystack = CARD_SEARCH_TEXT_BY_ID.get(cardType.id);
      return (haystack ?? "").includes(parsedQuery.text);
    },
    [
      cardCustomizedById,
      cardEnabledById,
      fuzzyMatchIds,
      effectiveCustomFilter,
      parsedQuery.enabled,
      parsedQuery.groupTerms,
      parsedQuery.text,
    ],
  );

  const {
    filteredGroups,
    filteredGroupTotals,
    visibleGroupNames,
    filteredCardCount,
    scopeCardCount,
  } = useMemo(() => {
    const result: Record<string, Array<(typeof statCardTypes)[0]>> = {};
    const totals: Record<string, { total: number; enabled: number }> = {};
    const visibleNames: string[] = [];
    let filteredCount = 0;
    let scopeCount = 0;

    for (const [groupName, cards] of Object.entries(cardGroups)) {
      if (selectedGroup !== "All" && selectedGroup !== groupName) continue;

      const {
        filtered,
        enabledCount,
        scopeCount: groupScopeCount,
      } = filterCardsInGroup(
        cards,
        matchesVisibility,
        matchesQuery,
        cardEnabledById,
      );
      scopeCount += groupScopeCount;
      filteredCount += filtered.length;

      if (filtered.length > 0) {
        result[groupName] = filtered;
        totals[groupName] = { total: filtered.length, enabled: enabledCount };
        visibleNames.push(groupName);
      }
    }

    return {
      filteredGroups: result,
      filteredGroupTotals: totals,
      visibleGroupNames: visibleNames,
      filteredCardCount: filteredCount,
      scopeCardCount: scopeCount,
    };
  }, [
    cardEnabledById,
    cardGroups,
    selectedGroup,
    visibility,
    matchesQuery,
    matchesVisibility,
  ]);

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    () => {
      const initial: Record<string, boolean> = {};
      for (const [index, name] of ALL_GROUP_NAMES.entries()) {
        initial[name] = index === 0;
      }
      return initial;
    },
  );

  // Incremented whenever expanded/collapsed state changes.
  // Useful for consumers that need to respond to layout shifts (e.g. window virtualization).
  const layoutVersionRef = useRef(0);

  useEffect(() => {
    if (selectedGroup === "All") return;
    setExpandedGroups((prev) => {
      layoutVersionRef.current += 1;
      return { ...prev, [selectedGroup]: true };
    });
  }, [selectedGroup]);

  const prevQueryRef = useRef(normalizedQuery);

  useEffect(() => {
    if (!normalizedQuery || normalizedQuery === prevQueryRef.current) return;
    prevQueryRef.current = normalizedQuery;
    setExpandedGroups((prev) => {
      layoutVersionRef.current += 1;
      const next = { ...prev };
      for (const groupName of visibleGroupNames) next[groupName] = true;
      return next;
    });
  }, [normalizedQuery, visibleGroupNames]);

  const expandAll = useCallback(() => {
    setExpandedGroups((prev) => {
      layoutVersionRef.current += 1;
      const next: Record<string, boolean> = { ...prev };
      for (const groupName of ALL_GROUP_NAMES) next[groupName] = true;
      return next;
    });
  }, []);

  const collapseAll = useCallback(() => {
    setExpandedGroups((prev) => {
      layoutVersionRef.current += 1;
      const next: Record<string, boolean> = { ...prev };
      for (const groupName of ALL_GROUP_NAMES) next[groupName] = false;
      return next;
    });
  }, []);

  const setGroupExpanded = useCallback((groupName: string, next: boolean) => {
    setExpandedGroups((prev) => {
      layoutVersionRef.current += 1;
      return { ...prev, [groupName]: next };
    });
  }, []);

  return {
    filteredGroups,
    cardGroups,
    groupTotals,
    filteredGroupTotals,
    visibleGroupNames,
    filteredCardCount,
    scopeCardCount,
    activeFilterCount,
    hasActiveFilters,
    isCardEnabled,
    expandAll,
    collapseAll,
    expandedGroups,
    setGroupExpanded,
    layoutVersion: layoutVersionRef.current,
  } as const;
}
