"use client";

import { useEffect } from "react";

import {
  type CustomFilter,
  parseCustomFilterParam,
} from "@/components/user/hooks/useCardFiltering";

const VALID_VISIBILITY = new Set(["all", "enabled", "disabled"]);
const NON_PAGE_NAVIGATION_PROTOCOLS = new Set(["mailto:", "sms:", "tel:"]);

export const LEAVE_EDITOR_CONFIRMATION_MESSAGE =
  "You have unsaved editor changes or a save in progress. If you leave now, AniCards may need to restore a local draft when you return. Leave this page?";

export type VisibilityFilter = "all" | "enabled" | "disabled";

export type EditorFilterState = {
  query: string;
  visibility: VisibilityFilter;
  selectedGroup: string;
  customFilter: CustomFilter;
};

export type ReorderModeFilterSession = Pick<
  EditorFilterState,
  "query" | "visibility" | "customFilter"
>;

export type SearchParamsLike = { get: (key: string) => string | null };

export function parseVisibilityParam(v: string | null): VisibilityFilter {
  return v && VALID_VISIBILITY.has(v) ? (v as VisibilityFilter) : "all";
}

export function hasReorderModeBlockingFilters(params: {
  query: string;
  visibility: VisibilityFilter;
  customFilter: CustomFilter;
}) {
  return (
    params.query.trim().length > 0 ||
    params.visibility !== "all" ||
    params.customFilter !== "all"
  );
}

export function captureReorderModeFilterSession(params: {
  query: string;
  visibility: VisibilityFilter;
  customFilter: CustomFilter;
}): ReorderModeFilterSession | null {
  if (!hasReorderModeBlockingFilters(params)) {
    return null;
  }

  return {
    query: params.query,
    visibility: params.visibility,
    customFilter: params.customFilter,
  };
}

export function clearReorderModeBlockingFilters(
  state: EditorFilterState,
): EditorFilterState {
  return {
    ...state,
    query: "",
    visibility: "all",
    customFilter: "all",
  };
}

export function restoreReorderModeFilterSession(params: {
  currentState: EditorFilterState;
  session: ReorderModeFilterSession | null;
}): EditorFilterState {
  if (!params.session) {
    return params.currentState;
  }

  return {
    ...params.currentState,
    query: params.session.query,
    visibility: params.session.visibility,
    customFilter: params.session.customFilter,
  };
}

export function syncFiltersFromSearchParams(opts: {
  searchParams: SearchParamsLike;
  query: string;
  visibility: VisibilityFilter;
  selectedGroup: string;
  customFilter: CustomFilter;
  setQuery: (v: string) => void;
  setVisibility: (v: VisibilityFilter) => void;
  setSelectedGroup: (v: string) => void;
  setCustomFilter: (v: CustomFilter) => void;
}) {
  const q = opts.searchParams.get("q") ?? "";
  const v = parseVisibilityParam(opts.searchParams.get("visibility"));
  const g = opts.searchParams.get("group") ?? "All";
  const nextCustomFilter = parseCustomFilterParam(
    opts.searchParams.get("customFilter"),
  );

  if (q !== opts.query) opts.setQuery(q);
  if (v !== opts.visibility) opts.setVisibility(v);
  if (g !== opts.selectedGroup) opts.setSelectedGroup(g);
  if (nextCustomFilter !== opts.customFilter)
    opts.setCustomFilter(nextCustomFilter);
}

export function buildEditorUrl(opts: {
  pathname: string;
  currentSearch: string;
  query: string;
  visibility: VisibilityFilter;
  selectedGroup: string;
  customFilter: CustomFilter;
}) {
  const params = new URLSearchParams(opts.currentSearch);

  if (opts.query) params.set("q", opts.query);
  else params.delete("q");

  if (opts.visibility && opts.visibility !== "all") {
    params.set("visibility", opts.visibility);
  } else {
    params.delete("visibility");
  }

  if (opts.selectedGroup && opts.selectedGroup !== "All") {
    params.set("group", opts.selectedGroup);
  } else {
    params.delete("group");
  }

  if (opts.customFilter && opts.customFilter !== "all") {
    params.set("customFilter", opts.customFilter);
  } else {
    params.delete("customFilter");
  }

  const search = params.toString();
  return search ? `${opts.pathname}?${search}` : opts.pathname;
}

export function useDebouncedEditorUrlSync(opts: {
  pathname: string;
  currentSearch: string;
  query: string;
  visibility: VisibilityFilter;
  selectedGroup: string;
  customFilter: CustomFilter;
  replace: (url: string) => void;
  debounceMs?: number;
}) {
  useEffect(() => {
    const timer = setTimeout(() => {
      const url = buildEditorUrl({
        pathname: opts.pathname,
        currentSearch: opts.currentSearch,
        query: opts.query,
        visibility: opts.visibility,
        selectedGroup: opts.selectedGroup,
        customFilter: opts.customFilter,
      });
      opts.replace(url);
    }, opts.debounceMs ?? 300);

    return () => clearTimeout(timer);
  }, [
    opts.currentSearch,
    opts.customFilter,
    opts.debounceMs,
    opts.pathname,
    opts.query,
    opts.replace,
    opts.selectedGroup,
    opts.visibility,
  ]);
}

export function shouldWarnBeforeLeavingEditor(params: {
  isDirty: boolean;
  isSaving: boolean;
  hasConflict: boolean;
}) {
  return params.isDirty || params.isSaving || params.hasConflict;
}

export function shouldPromptForEditorNavigation(params: {
  currentUrl: string;
  nextHref: string | null | undefined;
  target?: string | null;
  download?: boolean;
}) {
  if (!params.nextHref || params.download) return false;
  if (params.target && params.target !== "_self") return false;

  const current = new URL(params.currentUrl, globalThis.location.origin);

  let next: URL;
  try {
    next = new URL(params.nextHref, current);
  } catch {
    return false;
  }

  if (NON_PAGE_NAVIGATION_PROTOCOLS.has(next.protocol)) {
    return false;
  }

  if (next.protocol !== "http:" && next.protocol !== "https:") {
    return false;
  }

  if (next.origin !== current.origin) {
    return true;
  }

  return next.pathname !== current.pathname;
}
