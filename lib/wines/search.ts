import type { LocationType } from "./wine";

/**
 * Filtres de la recherche (types/wine.ts + SearchScreen/SearchFilters iOS),
 * sérialisés dans l'URL pour retrouver la recherche en revenant d'une fiche.
 */

export type WineSortOption =
  | "date_desc"
  | "date_asc"
  | "score_desc"
  | "score_asc"
  | "name_asc"
  | "vintage_desc";

export interface WineSearchFilters {
  term: string;
  buyAgainOnly: boolean;
  locationType: LocationType | null;
  scoreMin: number | null;
  scoreMax: number | null;
  dateFrom: string | null;
  dateTo: string | null;
  sortBy: WineSortOption;
}

export const DEFAULT_FILTERS: WineSearchFilters = {
  term: "",
  buyAgainOnly: false,
  locationType: null,
  scoreMin: null,
  scoreMax: null,
  dateFrom: null,
  dateTo: null,
  sortBy: "date_desc",
};

export const SORT_OPTIONS: { value: WineSortOption; label: string }[] = [
  { value: "date_desc", label: "Plus récent" },
  { value: "date_asc", label: "Plus ancien" },
  { value: "score_desc", label: "Meilleure note" },
  { value: "score_asc", label: "Note croissante" },
  { value: "name_asc", label: "Nom A→Z" },
  { value: "vintage_desc", label: "Millésime récent" },
];

export const LOCATION_OPTIONS: { value: LocationType | null; label: string }[] = [
  { value: null, label: "Tous" },
  { value: "home", label: "🏠 Maison" },
  { value: "friend", label: "👥 Amis" },
  { value: "restaurant", label: "🍽 Restaurant" },
];

/** Nombre de filtres actifs, compté comme iOS (le texte recherché n'en est pas un). */
export function activeFilterCount(f: WineSearchFilters): number {
  return [
    f.buyAgainOnly,
    f.locationType !== null,
    f.scoreMin !== null || f.scoreMax !== null,
    f.dateFrom !== null || f.dateTo !== null,
    f.sortBy !== "date_desc",
  ].filter(Boolean).length;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const SORTS = new Set<string>(SORT_OPTIONS.map((o) => o.value));
const LOCATIONS = new Set<string>(["home", "friend", "restaurant"]);

function score(value: string | null): number | null {
  if (value === null || value === "") return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 10 ? n : null;
}

/** Lit les filtres d'une URL ; toute valeur invalide est ignorée. */
export function filtersFromParams(params: URLSearchParams): WineSearchFilters {
  const loc = params.get("lieu");
  const sort = params.get("tri");
  const from = params.get("du");
  const to = params.get("au");
  return {
    term: (params.get("q") ?? "").slice(0, 100),
    buyAgainOnly: params.get("racheter") === "1",
    locationType: loc && LOCATIONS.has(loc) ? (loc as LocationType) : null,
    scoreMin: score(params.get("min")),
    scoreMax: score(params.get("max")),
    dateFrom: from && DAY.test(from) ? from : null,
    dateTo: to && DAY.test(to) ? to : null,
    sortBy: sort && SORTS.has(sort) ? (sort as WineSortOption) : "date_desc",
  };
}

/** Filtres → paramètres d'URL (seulement ceux qui diffèrent des valeurs par défaut). */
export function filtersToParams(f: WineSearchFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (f.term) params.set("q", f.term);
  if (f.sortBy !== "date_desc") params.set("tri", f.sortBy);
  if (f.locationType) params.set("lieu", f.locationType);
  if (f.scoreMin !== null) params.set("min", String(f.scoreMin));
  if (f.scoreMax !== null) params.set("max", String(f.scoreMax));
  if (f.dateFrom) params.set("du", f.dateFrom);
  if (f.dateTo) params.set("au", f.dateTo);
  if (f.buyAgainOnly) params.set("racheter", "1");
  return params;
}

/** Objet `searchParams` d'une page Next → URLSearchParams. */
export function toURLSearchParams(
  record: Record<string, string | string[] | undefined>,
): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(record)) {
    if (typeof value === "string") params.set(key, value);
    else if (Array.isArray(value) && value[0] !== undefined) params.set(key, value[0]);
  }
  return params;
}
