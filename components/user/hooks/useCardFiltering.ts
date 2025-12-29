import { useCallback, useEffect, useMemo, useState } from "react";
import { statCardTypes } from "@/components/stat-card-generator/constants";

function groupCardsByCategory() {
  const groups: Record<string, Array<(typeof statCardTypes)[0]>> = {};

  for (const cardType of statCardTypes) {
    if (!groups[cardType.group]) groups[cardType.group] = [];
    groups[cardType.group].push(cardType);
  }

  return groups;
}

export function useCardFiltering({
  cardConfigs,
  query,
  setQuery,
  visibility,
  setVisibility,
  selectedGroup,
  setSelectedGroup,
}: {
  cardConfigs: Record<string, { enabled?: boolean }>;
  query: string;
  setQuery: (q: string) => void;
  visibility: "all" | "enabled" | "disabled";
  setVisibility: (v: "all" | "enabled" | "disabled") => void;
  selectedGroup: string;
  setSelectedGroup: (g: string) => void;
}) {
  const cardGroups = useMemo(() => groupCardsByCategory(), []);

  const normalizedQuery = query.trim().toLowerCase();

  const isCardEnabled = useCallback(
    (cardId: string) => Boolean(cardConfigs[cardId]?.enabled),
    [cardConfigs],
  );

  const groupTotals = useMemo(() => {
    const map: Record<string, { total: number; enabled: number }> = {};
    for (const [groupName, cards] of Object.entries(cardGroups)) {
      const enabledCount = cards.reduce(
        (acc, c) => acc + (cardConfigs[c.id]?.enabled ? 1 : 0),
        0,
      );
      map[groupName] = { total: cards.length, enabled: enabledCount };
    }
    return map;
  }, [cardConfigs, cardGroups]);

  const filteredGroups = useMemo(() => {
    const result: Record<string, Array<(typeof statCardTypes)[0]>> = {};

    const matchesVisibility = (cardId: string) => {
      const enabled = Boolean(cardConfigs[cardId]?.enabled);
      if (visibility === "enabled") return enabled;
      if (visibility === "disabled") return !enabled;
      return true;
    };

    const matchesQuery = (cardType: (typeof statCardTypes)[0]) => {
      if (!normalizedQuery) return true;
      const haystack = `${cardType.label} ${cardType.id}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    };

    for (const [groupName, cards] of Object.entries(cardGroups)) {
      if (selectedGroup !== "All" && selectedGroup !== groupName) continue;
      const filtered = cards.filter(
        (cardType) => matchesVisibility(cardType.id) && matchesQuery(cardType),
      );
      if (filtered.length > 0) result[groupName] = filtered;
    }

    return result;
  }, [cardGroups, cardConfigs, normalizedQuery, selectedGroup, visibility]);

  const visibleGroupNames = useMemo(
    () => Object.keys(filteredGroups),
    [filteredGroups],
  );

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    () => {
      const groupNames = Object.keys(cardGroups || {});
      const initial: Record<string, boolean> = {};
      for (const [index, name] of groupNames.entries()) {
        initial[name] = index === 0;
      }
      return initial;
    },
  );

  useEffect(() => {
    if (selectedGroup === "All") return;
    setExpandedGroups((prev) => ({ ...prev, [selectedGroup]: true }));
  }, [selectedGroup]);

  useEffect(() => {
    if (!normalizedQuery) return;
    setExpandedGroups((prev) => {
      const next = { ...prev };
      for (const groupName of visibleGroupNames) next[groupName] = true;
      return next;
    });
  }, [normalizedQuery, visibleGroupNames]);

  const expandAll = useCallback(() => {
    setExpandedGroups((prev) => {
      const next: Record<string, boolean> = { ...prev };
      for (const groupName of Object.keys(cardGroups)) next[groupName] = true;
      return next;
    });
  }, [cardGroups]);

  const collapseAll = useCallback(() => {
    setExpandedGroups((prev) => {
      const next: Record<string, boolean> = { ...prev };
      for (const groupName of Object.keys(cardGroups)) next[groupName] = false;
      return next;
    });
  }, [cardGroups]);

  const setGroupExpanded = useCallback((groupName: string, next: boolean) => {
    setExpandedGroups((prev) => ({ ...prev, [groupName]: next }));
  }, []);

  return {
    filteredGroups,
    cardGroups,
    groupTotals,
    visibleGroupNames,
    isCardEnabled,
    expandAll,
    collapseAll,
    expandedGroups,
    setGroupExpanded,
  } as const;
}
