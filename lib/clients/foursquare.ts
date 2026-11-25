import "server-only";

const SEARCH_URL = "https://places-api.foursquare.com/places/search";
// 2024-06-01 (version de l'app iOS) est refusée : « Please provide a valid version ».
const API_VERSION = "2025-06-17";

export interface RestaurantSuggestion {
  id: string;
  name: string;
  address: string | null;
}

export class FoursquareError extends Error {
  constructor(readonly status: number) {
    super(`Foursquare HTTP ${status}`);
  }
}

/** Recherche de restaurants (mêmes paramètres que l'app iOS). */
export async function searchRestaurants(
  query: string,
  coords: { latitude: number; longitude: number } | null,
  signal?: AbortSignal,
): Promise<RestaurantSuggestion[]> {
  const apiKey = process.env.FOURSQUARE_API_KEY;
  if (!apiKey) throw new Error("FOURSQUARE_API_KEY is not set");

  const params = new URLSearchParams({ query, limit: "8" });
  if (coords) {
    params.set("ll", `${coords.latitude},${coords.longitude}`);
    params.set("radius", "5000");
  }

  const response = await fetch(`${SEARCH_URL}?${params}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "X-Places-Api-Version": API_VERSION,
      Accept: "application/json",
    },
    signal,
    cache: "no-store",
  });
  if (!response.ok) throw new FoursquareError(response.status);

  const data = (await response.json()) as {
    results?: Array<{
      fsq_place_id?: string;
      fsq_id?: string;
      name: string;
      location?: { formatted_address?: string };
    }>;
  };

  return (data.results ?? []).map((r, index) => ({
    // L'API actuelle renvoie fsq_place_id (fsq_id dans l'ancienne version).
    id: r.fsq_place_id ?? r.fsq_id ?? `${index}-${r.name}`,
    name: r.name,
    address: r.location?.formatted_address ?? null,
  }));
}
