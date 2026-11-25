import { z } from "zod";
import type { LocationType, Wine } from "./wine";

/**
 * Formulaire d'une dégustation (repris de WineForm iOS) et validation partagée
 * entre le téléphone (messages sous les champs) et le serveur (routes API).
 */

export interface WineFormValues {
  name: string;
  producer: string;
  appellation: string;
  vintage: string;
  score: number | null;
  location_type: LocationType;
  restaurant_name: string;
  drunk_at: string;
  food_pairing: string;
  photo_path: string | null;
  comment: string;
  companion: string;
  buy_again: boolean;
  cellar_entry_id: string | null;
}

export type WineFormErrors = Partial<Record<"name" | "vintage" | "drunk_at", string>>;

/** Date du jour au format AAAA-MM-JJ, dans le fuseau du téléphone. */
export function localToday(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function emptyWineForm(today = localToday()): WineFormValues {
  return {
    name: "",
    producer: "",
    appellation: "",
    vintage: "",
    score: null,
    location_type: "home",
    restaurant_name: "",
    drunk_at: today,
    food_pairing: "",
    photo_path: null,
    comment: "",
    companion: "",
    buy_again: false,
    cellar_entry_id: null,
  };
}

export function wineToForm(wine: Wine): WineFormValues {
  return {
    name: wine.name,
    producer: wine.producer ?? "",
    appellation: wine.appellation ?? "",
    vintage: wine.vintage?.toString() ?? "",
    score: wine.score,
    location_type: wine.location_type,
    restaurant_name: wine.restaurant_name ?? "",
    drunk_at: wine.drunk_at,
    food_pairing: wine.food_pairing ?? "",
    photo_path: wine.photo_path,
    comment: wine.comment ?? "",
    companion: wine.companion ?? "",
    buy_again: wine.buy_again,
    cellar_entry_id: wine.cellar_entry_id,
  };
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

function isRealDay(value: string): boolean {
  if (!DAY.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Mêmes règles et messages que useWineForm iOS. */
export function validateWineForm(form: WineFormValues, now = new Date()): WineFormErrors {
  const errors: WineFormErrors = {};
  if (!form.name.trim()) errors.name = "Le nom du vin est obligatoire";

  if (form.vintage.trim()) {
    const year = now.getFullYear();
    const v = Number(form.vintage.trim());
    if (!Number.isInteger(v) || v < 1800 || v > year) {
      errors.vintage = `Millésime invalide (1800–${year})`;
    }
  }

  if (!form.drunk_at || !isRealDay(form.drunk_at)) {
    errors.drunk_at = "Date invalide (format AAAA-MM-JJ)";
  }
  return errors;
}

const optionalText = z
  .string()
  .max(5000)
  .transform((s) => s.trim() || null);

/** Validation serveur du corps envoyé par le formulaire → valeurs prêtes pour la base. */
export const WineInputSchema = z
  .object({
    name: z.string().trim().min(1, "Le nom du vin est obligatoire").max(300),
    producer: optionalText,
    appellation: optionalText,
    vintage: z
      .string()
      .trim()
      .transform((s, ctx) => {
        if (!s) return null;
        const v = Number(s);
        // +1 : tolère le passage d'année entre le téléphone et le serveur.
        if (!Number.isInteger(v) || v < 1800 || v > new Date().getFullYear() + 1) {
          ctx.addIssue({ code: "custom", message: "Millésime invalide" });
          return z.NEVER;
        }
        return v;
      }),
    score: z.number().min(0).max(10).nullable(),
    location_type: z.enum(["home", "friend", "restaurant"]),
    restaurant_name: optionalText,
    drunk_at: z.string().refine(isRealDay, "Date invalide"),
    food_pairing: optionalText,
    photo_path: z
      .string()
      .regex(/^wine-photos\/[A-Za-z0-9][A-Za-z0-9._-]*$/)
      .nullable(),
    comment: optionalText,
    companion: optionalText,
    buy_again: z.boolean(),
    cellar_entry_id: z.uuid().nullable(),
  })
  .transform((input) => ({
    ...input,
    // Comme iOS : le nom du restaurant n'est gardé que pour un restaurant.
    restaurant_name: input.location_type === "restaurant" ? input.restaurant_name : null,
  }));

export type WineInput = z.output<typeof WineInputSchema>;
