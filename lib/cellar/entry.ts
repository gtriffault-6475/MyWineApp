import { z } from "zod";

/**
 * Bouteille en cave — modèle, apogée et formulaire, repris de l'app iOS
 * (types/cellar.ts, CellarCard.tsx, CellarDetailScreen.tsx, CellarForm.tsx).
 */

export interface Cave {
  id: string;
  name: string;
  /** Nombre de références en cave (non archivées), comme le compteur iOS. */
  bottle_count: number;
}

export interface CellarEntry {
  id: string;
  cave_id: string | null;
  name: string;
  producer: string | null;
  appellation: string | null;
  vintage: string | null;
  quantity: number;
  quantity_initial: number;
  purchase_date: string | null;
  purchase_price: number | null;
  optimal_from: number | null;
  optimal_to: number | null;
  storage_location: string | null;
  notes: string | null;
  photo_path: string | null;
  archived: boolean;
}

/** Nombre maximum de caves (CaveListScreen.tsx iOS). */
export const MAX_CAVES = 5;

export const CaveNameSchema = z.object({
  name: z.string().trim().min(1, "Le nom de la cave est obligatoire").max(100),
});

export type ApogeeStatus = "peak" | "past" | "early" | "unknown";

export function apogeeLabel(e: Pick<CellarEntry, "optimal_from" | "optimal_to">): string | null {
  const { optimal_from, optimal_to } = e;
  if (optimal_from && optimal_to) return `${optimal_from} – ${optimal_to}`;
  if (optimal_from) return `À partir de ${optimal_from}`;
  if (optimal_to) return `Jusqu'en ${optimal_to}`;
  return null;
}

export function apogeeStatus(
  e: Pick<CellarEntry, "optimal_from" | "optimal_to">,
  year = new Date().getFullYear(),
): ApogeeStatus {
  const { optimal_from, optimal_to } = e;
  if (!optimal_from && !optimal_to) return "unknown";
  if (optimal_to && year > optimal_to) return "past";
  if (optimal_from && year < optimal_from) return "early";
  return "peak";
}

export const APOGEE_ICONS: Record<ApogeeStatus, string> = {
  peak: "✦",
  past: "↓",
  early: "◎",
  unknown: "",
};

export const APOGEE_LABELS: Record<ApogeeStatus, string> = {
  peak: "À son apogée",
  past: "Passé l'apogée",
  early: "Trop tôt",
  unknown: "",
};

export const APOGEE_COLORS: Record<ApogeeStatus, string> = {
  peak: "var(--success)",
  past: "var(--text-muted)",
  early: "var(--score-gold)",
  unknown: "var(--text-light)",
};

export function bottlesLabel(count: number): string {
  return `${count} bouteille${count !== 1 ? "s" : ""}`;
}

/** « 24,90 € · 14 mars 2020 », ou null si rien n'est renseigné. */
export function purchaseSummary(e: Pick<CellarEntry, "purchase_price" | "purchase_date">): string | null {
  const parts: string[] = [];
  if (e.purchase_price) parts.push(`${e.purchase_price} €`);
  if (e.purchase_date) {
    const date = new Date(`${e.purchase_date}T12:00:00Z`);
    if (!Number.isNaN(date.getTime())) {
      parts.push(
        date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }),
      );
    }
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

// ---------------------------------------------------------------------------
// Formulaire
// ---------------------------------------------------------------------------

export interface CellarFormValues {
  cave_id: string | null;
  name: string;
  producer: string;
  appellation: string;
  vintage: string;
  quantity: string;
  purchase_date: string;
  purchase_price: string;
  optimal_from: string;
  optimal_to: string;
  storage_location: string;
  notes: string;
  photo_path: string | null;
}

export type CellarFormErrors = Partial<
  Record<"name" | "quantity" | "vintage" | "optimal_to" | "purchase_price", string>
>;

export function emptyCellarForm(caveId: string | null): CellarFormValues {
  return {
    cave_id: caveId,
    name: "",
    producer: "",
    appellation: "",
    vintage: "",
    quantity: "1",
    purchase_date: "",
    purchase_price: "",
    optimal_from: "",
    optimal_to: "",
    storage_location: "",
    notes: "",
    photo_path: null,
  };
}

export function entryToForm(e: CellarEntry): CellarFormValues {
  return {
    cave_id: e.cave_id,
    name: e.name,
    producer: e.producer ?? "",
    appellation: e.appellation ?? "",
    vintage: e.vintage ?? "",
    quantity: e.quantity.toString(),
    purchase_date: e.purchase_date ?? "",
    purchase_price: e.purchase_price?.toString() ?? "",
    optimal_from: e.optimal_from?.toString() ?? "",
    optimal_to: e.optimal_to?.toString() ?? "",
    storage_location: e.storage_location ?? "",
    notes: e.notes ?? "",
    photo_path: e.photo_path,
  };
}

/** Prix saisi « 24,90 » ou « 24.90 » → nombre, null si vide, NaN si invalide. */
export function parsePrice(raw: string): number | null {
  const s = raw.trim().replace(",", ".");
  if (!s) return null;
  return /^\d+(\.\d{1,2})?$/.test(s) ? Number(s) : Number.NaN;
}

/** Mêmes règles et messages que CellarForm.tsx iOS (+ contrôle du prix). */
export function validateCellarForm(form: CellarFormValues, now = new Date()): CellarFormErrors {
  const errors: CellarFormErrors = {};
  if (!form.name.trim()) errors.name = "Le nom est obligatoire";

  const qty = Number(form.quantity.trim());
  if (!form.quantity.trim() || !Number.isInteger(qty) || qty < 1) {
    errors.quantity = "Quantité invalide (min. 1)";
  }

  if (form.vintage.trim()) {
    const max = now.getFullYear() + 5;
    const v = Number(form.vintage.trim());
    if (!Number.isInteger(v) || v < 1800 || v > max) {
      errors.vintage = `Millésime invalide (1800–${max})`;
    }
  }

  const from = Number(form.optimal_from);
  const to = Number(form.optimal_to);
  if (form.optimal_from && form.optimal_to && from > to) {
    errors.optimal_to = "La fin doit être après le début";
  }

  if (Number.isNaN(parsePrice(form.purchase_price))) errors.purchase_price = "Prix invalide";
  return errors;
}

const optionalText = z
  .string()
  .max(5000)
  .transform((s) => s.trim() || null);

const optionalYear = z
  .string()
  .trim()
  .transform((s, ctx) => {
    if (!s) return null;
    const v = Number(s);
    if (!Number.isInteger(v) || v < 1800 || v > 2200) {
      ctx.addIssue({ code: "custom", message: "Année invalide" });
      return z.NEVER;
    }
    return v;
  });

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Validation serveur → valeurs prêtes pour la base. */
export const CellarInputSchema = z
  .object({
    cave_id: z.uuid().nullable(),
    name: z.string().trim().min(1, "Le nom est obligatoire").max(300),
    producer: optionalText,
    appellation: optionalText,
    vintage: z
      .string()
      .trim()
      .max(20)
      .transform((s) => s || null),
    quantity: z
      .string()
      .trim()
      .transform((s, ctx) => {
        const n = Number(s);
        if (!s || !Number.isInteger(n) || n < 1 || n > 9999) {
          ctx.addIssue({ code: "custom", message: "Quantité invalide (min. 1)" });
          return z.NEVER;
        }
        return n;
      }),
    purchase_date: z
      .string()
      .trim()
      .refine((s) => !s || (DAY.test(s) && !Number.isNaN(Date.parse(s))), "Date d'achat invalide")
      .transform((s) => s || null),
    purchase_price: z.string().transform((s, ctx) => {
      const price = parsePrice(s);
      if (Number.isNaN(price)) {
        ctx.addIssue({ code: "custom", message: "Prix invalide" });
        return z.NEVER;
      }
      return price;
    }),
    optimal_from: optionalYear,
    optimal_to: optionalYear,
    storage_location: optionalText,
    notes: optionalText,
    photo_path: z
      .string()
      .regex(/^wine-photos\/[A-Za-z0-9][A-Za-z0-9._-]*$/)
      .nullable(),
  })
  .refine(
    (v) => v.optimal_from === null || v.optimal_to === null || v.optimal_from <= v.optimal_to,
    { message: "La fin doit être après le début", path: ["optimal_to"] },
  );

export type CellarInput = z.output<typeof CellarInputSchema>;
