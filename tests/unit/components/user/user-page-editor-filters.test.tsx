import "@/tests/unit/__setup__";

import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  vi,
} from "bun:test";

import { statCardTypes } from "@/lib/card-types";
import {
  flushMicrotasks,
  installHappyDom,
  resetHappyDom,
  restoreHappyDom,
} from "@/tests/unit/hooks/test-helpers";

installHappyDom("https://anicards.test/user/Alpha49");

const { act, cleanup, renderHook } = await import("@testing-library/react");
const {
  buildEditorUrl,
  syncFiltersFromSearchParams,
  useDebouncedEditorUrlSync,
} = await import("@/components/user/UserPageEditor");
const { parseCardSearchQuery, tokenizeQuery, useCardFiltering } =
  await import("@/components/user/hooks/useCardFiltering");

beforeEach(() => {
  vi.useFakeTimers();
  resetHappyDom();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

afterAll(() => {
  mock.restore();
  restoreHappyDom();
});

describe("editor filter query semantics", () => {
  it("tokenizes quoted search clauses and preserves key:value tokens", () => {
    expect(
      tokenizeQuery('group:"Core Stats" custom:yes enabled:true seasonal'),
    ).toEqual(["group:Core Stats", "custom:yes", "enabled:true", "seasonal"]);
  });

  it("parses free text and custom filter tokens symmetrically", () => {
    expect(
      parseCardSearchQuery(
        'Seasonal Favorites custom:no status:enabled group:"Deep Dive"',
      ),
    ).toEqual({
      text: "seasonal favorites",
      groupTerms: ["deep dive"],
      enabled: true,
      custom: false,
    });
  });

  it("filters cards by explicit customFilter prop and query token semantics", () => {
    const firstCard = statCardTypes[0];
    const secondCard = statCardTypes[1];

    if (!firstCard || !secondCard) {
      throw new Error("Expected at least two card types for filtering tests.");
    }

    const cardEnabledById = {
      [firstCard.id]: true,
      [secondCard.id]: true,
    } satisfies Record<string, boolean>;

    const cardCustomizedById = {
      [firstCard.id]: true,
      [secondCard.id]: false,
    } satisfies Record<string, boolean>;

    const customized = renderHook(() =>
      useCardFiltering({
        cardCustomizedById,
        cardEnabledById,
        cardOrder: [firstCard.id, secondCard.id],
        customFilter: "customized",
        fuzzy: false,
        query: "",
        selectedGroup: "All",
        visibility: "all",
      }),
    );

    expect(customized.result.current.filteredCardCount).toBe(1);
    expect(customized.result.current.visibleGroupNames).toContain(
      firstCard.group,
    );
    expect(
      Object.values(customized.result.current.filteredGroups)
        .flat()
        .map((card) => card.id),
    ).toEqual([firstCard.id]);

    customized.unmount();

    const tokenDriven = renderHook(() =>
      useCardFiltering({
        cardCustomizedById,
        cardEnabledById,
        cardOrder: [firstCard.id, secondCard.id],
        customFilter: "all",
        fuzzy: false,
        query: `${secondCard.label} custom:false`,
        selectedGroup: "All",
        visibility: "all",
      }),
    );

    expect(
      Object.values(tokenDriven.result.current.filteredGroups)
        .flat()
        .map((card) => card.id),
    ).toEqual([secondCard.id]);
  });
});

describe("editor filter URL semantics", () => {
  it("hydrates customFilter from search params and normalizes invalid values", () => {
    const setQuery = mock((value: string) => value);
    const setVisibility = mock((value: string) => value);
    const setSelectedGroup = mock((value: string) => value);
    const setCustomFilter = mock((value: string) => value);

    syncFiltersFromSearchParams({
      searchParams: new URLSearchParams(
        "q=seasonal&visibility=enabled&group=Core+Stats&customFilter=customized",
      ),
      query: "",
      visibility: "all",
      selectedGroup: "All",
      customFilter: "all",
      setQuery,
      setVisibility,
      setSelectedGroup,
      setCustomFilter,
    });

    expect(setQuery).toHaveBeenCalledWith("seasonal");
    expect(setVisibility).toHaveBeenCalledWith("enabled");
    expect(setSelectedGroup).toHaveBeenCalledWith("Core Stats");
    expect(setCustomFilter).toHaveBeenCalledWith("customized");

    setCustomFilter.mockReset();

    syncFiltersFromSearchParams({
      searchParams: new URLSearchParams("customFilter=whoops"),
      query: "",
      visibility: "all",
      selectedGroup: "All",
      customFilter: "customized",
      setQuery,
      setVisibility,
      setSelectedGroup,
      setCustomFilter,
    });

    expect(setCustomFilter).toHaveBeenCalledWith("all");
  });

  it("serializes and clears customFilter symmetrically in editor URLs", () => {
    expect(
      buildEditorUrl({
        pathname: "/user/Alpha49",
        currentSearch: "?foo=bar",
        query: "seasonal",
        visibility: "enabled",
        selectedGroup: "Core Stats",
        customFilter: "customized",
      }),
    ).toBe(
      "/user/Alpha49?foo=bar&q=seasonal&visibility=enabled&group=Core+Stats&customFilter=customized",
    );

    expect(
      buildEditorUrl({
        pathname: "/user/Alpha49",
        currentSearch:
          "?q=seasonal&visibility=enabled&group=Core+Stats&customFilter=customized",
        query: "",
        visibility: "all",
        selectedGroup: "All",
        customFilter: "all",
      }),
    ).toBe("/user/Alpha49");
  });

  it("debounces router replacements when editor filters change", async () => {
    const replace = mock((url: string) => url);

    const { rerender } = renderHook(
      (props: {
        currentSearch: string;
        customFilter: "all" | "customized" | "uncustomized";
        query: string;
      }) =>
        useDebouncedEditorUrlSync({
          pathname: "/user/Alpha49",
          currentSearch: props.currentSearch,
          query: props.query,
          visibility: "all",
          selectedGroup: "All",
          customFilter: props.customFilter,
          replace,
          debounceMs: 300,
        }),
      {
        initialProps: {
          currentSearch: "",
          customFilter: "all",
          query: "seasonal",
        },
      },
    );

    await act(async () => {
      vi.advanceTimersByTime(299);
      await flushMicrotasks();
    });
    expect(replace).not.toHaveBeenCalled();

    rerender({
      currentSearch: "",
      customFilter: "customized",
      query: "seasonal favorites",
    });

    await act(async () => {
      vi.advanceTimersByTime(299);
      await flushMicrotasks();
    });
    expect(replace).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1);
      await flushMicrotasks();
    });

    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith(
      "/user/Alpha49?q=seasonal+favorites&customFilter=customized",
    );
  });
});
