import { describe, expect, it } from "vitest";
import {
  activeFilterCount,
  DEFAULT_FILTERS,
  filtersFromParams,
  filtersToParams,
  toURLSearchParams,
  type WineSearchFilters,
} from "./search";

describe("activeFilterCount (iOS)", () => {
  it("ignores the search term and counts each filter group once", () => {
    expect(activeFilterCount({ ...DEFAULT_FILTERS, term: "margaux" })).toBe(0);
    expect(
      activeFilterCount({
        ...DEFAULT_FILTERS,
        buyAgainOnly: true,
        locationType: "restaurant",
        scoreMin: 7,
        scoreMax: 10,
        dateFrom: "2025-01-01",
        sortBy: "score_desc",
      }),
    ).toBe(5);
  });
});

describe("filtres ↔ URL", () => {
  it("round-trips every filter", () => {
    const filters: WineSearchFilters = {
      term: "Côte du Py",
      buyAgainOnly: true,
      locationType: "friend",
      scoreMin: 6,
      scoreMax: 9,
      dateFrom: "2025-01-01",
      dateTo: "2025-12-31",
      sortBy: "vintage_desc",
    };
    expect(filtersFromParams(filtersToParams(filters))).toEqual(filters);
  });

  it("produces an empty query string for the default filters", () => {
    expect(filtersToParams(DEFAULT_FILTERS).toString()).toBe("");
  });

  it("ignores invalid values from a hand-edited URL", () => {
    const parsed = filtersFromParams(
      new URLSearchParams("tri=hasard&lieu=bateau&min=0&max=11&du=hier&au=2025-13&racheter=oui"),
    );
    expect(parsed).toEqual(DEFAULT_FILTERS);
  });

  it("reads Next.js searchParams objects", () => {
    expect(toURLSearchParams({ q: "a", tri: ["score_desc", "x"], vide: undefined }).toString()).toBe(
      "q=a&tri=score_desc",
    );
  });
});
