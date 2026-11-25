import { NextResponse } from "next/server";
import { FoursquareError, searchRestaurants } from "@/lib/clients/foursquare";

/** Autocomplétion des restaurants : GET /api/restaurants?q=…&ll=lat,lng */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = (params.get("q") ?? "").trim().slice(0, 100);
  if (!query) return NextResponse.json({ results: [] });

  let coords: { latitude: number; longitude: number } | null = null;
  const ll = params.get("ll")?.split(",").map(Number);
  if (ll?.length === 2 && ll.every(Number.isFinite) && Math.abs(ll[0]) <= 90 && Math.abs(ll[1]) <= 180) {
    coords = { latitude: ll[0], longitude: ll[1] };
  }

  try {
    const results = await searchRestaurants(query, coords, request.signal);
    return NextResponse.json({ results });
  } catch (error) {
    if (error instanceof FoursquareError) {
      // Mêmes messages que l'app iOS (RestaurantAutocomplete.tsx).
      const message =
        error.status === 401 || error.status === 403
          ? "Clé API Foursquare invalide"
          : error.status === 429
            ? "Quota API dépassé (1 000 req/jour)"
            : `Erreur API Foursquare (${error.status})`;
      return NextResponse.json({ error: message }, { status: 502 });
    }
    console.error("Recherche de restaurants impossible :", error);
    return NextResponse.json({ error: "Recherche impossible pour le moment." }, { status: 502 });
  }
}
