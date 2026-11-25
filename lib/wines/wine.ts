/**
 * Dégustation — modèle et mise en forme, repris de l'app iOS
 * (src/types/wine.ts, WineCard.tsx, WineDetailScreen.tsx).
 * Fonctions pures, partagées entre Server et Client Components.
 */

export type LocationType = "home" | "friend" | "restaurant";

export interface Wine {
  id: string;
  name: string;
  producer: string | null;
  appellation: string | null;
  vintage: number | null;
  score: number | null;
  location_type: LocationType;
  restaurant_name: string | null;
  drunk_at: string; // AAAA-MM-JJ
  food_pairing: string | null;
  photo_path: string | null;
  comment: string | null;
  companion: string | null;
  buy_again: boolean;
  cellar_entry_id: string | null;
  created_at: string;
  updated_at: string;
}

export const LOCATION_LABELS: Record<LocationType, string> = {
  home: "À la maison",
  friend: "Chez des amis",
  restaurant: "Restaurant",
};

/** Nom affiché d'un vin : « Nom Millésime ». */
export function wineTitle(wine: Pick<Wine, "name" | "vintage">): string {
  return wine.vintage ? `${wine.name} ${wine.vintage}` : wine.name;
}

/** « Producteur · Appellation », ou null si les deux sont vides. */
export function wineSubtitle(wine: Pick<Wine, "producer" | "appellation">): string | null {
  const parts = [wine.producer, wine.appellation].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** Lieu : le nom du restaurant s'il est connu, sinon le libellé du type. */
export function locationLabel(
  wine: Pick<Wine, "location_type" | "restaurant_name">,
): string {
  if (wine.location_type === "restaurant" && wine.restaurant_name) {
    return wine.restaurant_name;
  }
  return LOCATION_LABELS[wine.location_type] ?? wine.location_type;
}

// Les dates sont des jours calendaires (AAAA-MM-JJ) : on les formate en UTC
// pour obtenir le même jour quel que soit le fuseau du serveur ou du téléphone.
function parseDay(day: string): Date | null {
  const date = new Date(`${day}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** « 24 déc. » — format de la liste. */
export function formatShortDate(day: string): string {
  const date = parseDay(day);
  if (!date) return "";
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
}

/** « 24 décembre 2024 » — format de la fiche. */
export function formatLongDate(day: string): string {
  const date = parseDay(day);
  if (!date) return "";
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Nombre d'étoiles pleines (sur 5) pour une note sur 10. */
export function filledStars(score: number | null): number {
  if (score === null) return 0;
  return Math.min(5, Math.max(0, Math.round(score / 2)));
}

/** URL de la photo servie par l'app (jamais l'URL Blob brute). */
export function photoUrl(photoPath: string | null, width?: number): string | null {
  if (!photoPath) return null;
  const base = `/api/photos/${photoPath.split("/").map(encodeURIComponent).join("/")}`;
  return width ? `${base}?w=${width}` : base;
}
