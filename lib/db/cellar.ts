import "server-only";
import { connection } from "next/server";
import { sql } from "@/lib/db/client";
import { orphanOrNull } from "@/lib/db/photos";
import type { CellarEntry, CellarInput } from "@/lib/cellar/entry";

const ENTRY_COLUMNS = `
  id, cave_id, name, producer, appellation, vintage, quantity, quantity_initial,
  purchase_date::text AS purchase_date, purchase_price::float8 AS purchase_price,
  optimal_from, optimal_to, storage_location, notes, photo_path, archived
`;

/** Bouteilles en cave d'une cave, triées par nom puis millésime (comme iOS). */
export async function listEntriesForCave(caveId: string): Promise<CellarEntry[]> {
  await connection();
  return (await sql.query(
    `SELECT ${ENTRY_COLUMNS} FROM cellar_entry
     WHERE cave_id = $1 AND NOT archived
     ORDER BY name, vintage NULLS FIRST`,
    [caveId],
  )) as unknown as CellarEntry[];
}

/** Une bouteille, archivée ou non. */
export async function getEntry(id: string): Promise<CellarEntry | null> {
  await connection();
  const rows = (await sql.query(`SELECT ${ENTRY_COLUMNS} FROM cellar_entry WHERE id = $1`, [
    id,
  ])) as unknown as CellarEntry[];
  return rows[0] ?? null;
}

const WRITABLE = [
  "cave_id", "name", "producer", "appellation", "vintage", "quantity",
  "purchase_date", "purchase_price", "optimal_from", "optimal_to",
  "storage_location", "notes", "photo_path",
] as const satisfies readonly (keyof CellarInput)[];

/**
 * Comme cellarFormToDb iOS : à chaque enregistrement, la quantité initiale
 * reprend la quantité saisie et la bouteille est désarchivée.
 */
export async function insertEntry(input: CellarInput): Promise<string> {
  const cols = [...WRITABLE, "quantity_initial", "archived"];
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
  const rows = (await sql.query(
    `INSERT INTO cellar_entry (${cols.join(", ")}) VALUES (${placeholders}) RETURNING id`,
    [...WRITABLE.map((c) => input[c]), input.quantity, false],
  )) as unknown as { id: string }[];
  return rows[0].id;
}

export async function updateEntry(
  id: string,
  input: CellarInput,
): Promise<{ orphanPhotoPath: string | null } | null> {
  const assignments = WRITABLE.map((c, i) => `${c} = $${i + 2}`).join(", ");
  const rows = (await sql.query(
    `WITH previous AS (SELECT photo_path FROM cellar_entry WHERE id = $1)
     UPDATE cellar_entry
     SET ${assignments}, quantity_initial = $${WRITABLE.length + 2}, archived = false, updated_at = now()
     WHERE id = $1
     RETURNING (SELECT photo_path FROM previous) AS previous_photo_path`,
    [id, ...WRITABLE.map((c) => input[c]), input.quantity],
  )) as unknown as { previous_photo_path: string | null }[];
  if (rows.length === 0) return null;
  const previous = rows[0].previous_photo_path;
  if (previous === input.photo_path) return { orphanPhotoPath: null };
  return { orphanPhotoPath: await orphanOrNull(previous) };
}

/** Supprime une bouteille (ses dégustations restent, sans lien vers la cave). */
export async function deleteEntry(id: string): Promise<{ orphanPhotoPath: string | null } | null> {
  const rows = (await sql.query(
    `DELETE FROM cellar_entry WHERE id = $1 RETURNING photo_path, cave_id`,
    [id],
  )) as unknown as { photo_path: string | null }[];
  if (rows.length === 0) return null;
  return { orphanPhotoPath: await orphanOrNull(rows[0].photo_path) };
}

/**
 * « Ouvrir une bouteille » : décompte une bouteille ; à la dernière, la
 * référence est archivée (decrementCellarQuantity iOS).
 */
export async function openBottle(
  id: string,
): Promise<{ quantity: number; archived: boolean } | null> {
  const rows = (await sql.query(
    `UPDATE cellar_entry
     SET quantity = GREATEST(0, quantity - 1),
         archived = quantity <= 1,
         updated_at = now()
     WHERE id = $1
     RETURNING quantity, archived`,
    [id],
  )) as unknown as { quantity: number; archived: boolean }[];
  return rows[0] ?? null;
}
