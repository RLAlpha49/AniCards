import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Fuse from "fuse.js";
import { statCardTypes } from "@/components/stat-card-generator/constants";

function groupCardsByCategory() {
  const groups: Record<string, Array<(typeof statCardTypes)[0]>> = {};

  for (const cardType of statCardTypes) {
    if (!groups[cardType.group]) groups[cardType.group] = [];
    groups[cardType.group].push(cardType);
  }

  return groups;
}

const CARD_GROUPS = groupCardsByCategory();
const ALL_GROUP_NAMES = Object.keys(CARD_GROUPS);
const CARD_SEARCH_TEXT_BY_ID = new Map<string, string>(
  statCardTypes.map((t) => [t.id, `${t.label} ${t.id}`.toLowerCase()]),
);

export function useCardFiltering({
  cardEnabledById,
  query,
  visibility,
  selectedGroup,
  fuzzy = true,
}: {
  cardEnabledById: Record<string, boolean | undefined>;
  query: string;
  visibility: "all" | "enabled" | "disabled";
  selectedGroup: string;
  fuzzy?: boolean;
}) {
  const cardGroups = CARD_GROUPS;

  const normalizedQuery = useMemo(() => query.trim().toLowerCase(), [query]);

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

  // Memoize Fuse instance to avoid rebuilding the index on each query.
  const fuse = useMemo(() => {
    if (!fuzzy) return null;
    const items = statCardTypes.map((t) => ({ id: t.id, label: t.label }));
    return new Fuse<{ id: string; label: string }>(items, {
      keys: ["label", "id"],
      threshold: 0.35,
      ignoreLocation: true,
    });
  }, [fuzzy]);

  // Compute fuzzy matches set when query is present and fuse is available
  const fuzzyMatchIds = useMemo(() => {
    if (!normalizedQuery || !fuse) return null;
    const results = fuse.search(normalizedQuery);
    return new Set(results.map((r) => r.item.id));
  }, [normalizedQuery, fuse]);

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
      if (!normalizedQuery) return true;
      if (fuzzyMatchIds) return fuzzyMatchIds.has(cardType.id);
      const haystack = CARD_SEARCH_TEXT_BY_ID.get(cardType.id);
      return (haystack ?? "").includes(normalizedQuery);
    },
    [normalizedQuery, fuzzyMatchIds],
  );

  const { filteredGroups, filteredGroupTotals, visibleGroupNames } =
    useMemo(() => {
      const result: Record<string, Array<(typeof statCardTypes)[0]>> = {};
      const totals: Record<string, { total: number; enabled: number }> = {};
      const visibleNames: string[] = [];

      for (const [groupName, cards] of Object.entries(cardGroups)) {
        if (selectedGroup !== "All" && selectedGroup !== groupName) continue;

        const filtered: Array<(typeof statCardTypes)[0]> = [];
        let enabledCount = 0;

        for (const cardType of cards) {
          if (!matchesVisibility(cardType.id) || !matchesQuery(cardType))
            continue;
          filtered.push(cardType);
          if (cardEnabledById[cardType.id]) enabledCount += 1;
        }

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
      };
    }, [
      cardEnabledById,
      cardGroups,
      normalizedQuery,
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
    isCardEnabled,
    expandAll,
    collapseAll,
    expandedGroups,
    setGroupExpanded,
    layoutVersion: layoutVersionRef.current,
  } as const;
}
