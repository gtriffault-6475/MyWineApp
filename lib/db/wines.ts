import "server-only";
import { connection } from "next/server";
import { sql } from "@/lib/db/client";
import type { Wine } from "@/lib/wines/wine";
import type { WineInput } from "@/lib/wines/input";

// Les dates sont renvoyées en texte : jours calendaires « AAAA-MM-JJ » et
// horodatages ISO, sans conversion de fuseau par le driver.
const WINE_COLUMNS = `
  id, name, producer, appellation, vintage, score, location_type,
  restaurant_name, drunk_at::text AS drunk_at, food_pairing, photo_path,
  comment, companion, buy_again, cellar_entry_id,
  to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at,
  to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS updated_at
`;

/** Toutes les dégustations, plus récentes d'abord (même tri que l'app iOS). */
export async function listWines(): Promise<Wine[]> {
  await connection();
  return (await sql.query(
    `SELECT ${WINE_COLUMNS} FROM wine ORDER BY drunk_at DESC, created_at DESC`,
  )) as unknown as Wine[];
}

export async function getWineById(id: string): Promise<Wine | null> {
  await connection();
  const rows = (await sql.query(`SELECT ${WINE_COLUMNS} FROM wine WHERE id = $1`, [
    id,
  ])) as unknown as Wine[];
  return rows[0] ?? null;
}

/**
 * Supprime une dégustation. Retourne `null` si elle n'existait pas, sinon le
 * chemin de sa photo s'il n'est plus utilisé par aucune autre fiche (une même
 * photo peut être partagée avec une bouteille de la cave) — à supprimer du
 * stockage par l'appelant.
 */
export async function deleteWine(
  id: string,
): Promise<{ orphanPhotoPath: string | null } | null> {
  const deleted = (await sql.query(`DELETE FROM wine WHERE id = $1 RETURNING photo_path`, [
    id,
  ])) as unknown as { photo_path: string | null }[];
  if (deleted.length === 0) return null;

  const photoPath = deleted[0].photo_path;
  if (!photoPath) return { orphanPhotoPath: null };

  return { orphanPhotoPath: (await isPhotoUsed(photoPath)) ? null : photoPath };
}

const WRITABLE_COLUMNS = [
  "name", "producer", "appellation", "vintage", "score", "location_type",
  "restaurant_name", "drunk_at", "food_pairing", "photo_path", "comment",
  "companion", "buy_again", "cellar_entry_id",
] as const satisfies readonly (keyof WineInput)[];

function values(input: WineInput) {
  return WRITABLE_COLUMNS.map((column) => input[column]);
}

/** Crée une dégustation et retourne son identifiant. */
export async function insertWine(input: WineInput): Promise<string> {
  const placeholders = WRITABLE_COLUMNS.map((_, i) => `$${i + 1}`).join(", ");
  const rows = (await sql.query(
    `INSERT INTO wine (${WRITABLE_COLUMNS.join(", ")}) VALUES (${placeholders}) RETURNING id`,
    values(input),
  )) as unknown as { id: string }[];
  return rows[0].id;
}

/**
 * Met à jour une dégustation. Retourne `null` si elle n'existe pas, sinon
 * l'ancienne photo si elle a été remplacée ou retirée et n'est plus utilisée
 * ailleurs — à supprimer du stockage par l'appelant.
 */
export async function updateWine(
  id: string,
  input: WineInput,
): Promise<{ orphanPhotoPath: string | null } | null> {
  const assignments = WRITABLE_COLUMNS.map((column, i) => `${column} = $${i + 2}`).join(", ");
  const rows = (await sql.query(
    `WITH previous AS (SELECT photo_path FROM wine WHERE id = $1)
     UPDATE wine SET ${assignments}, updated_at = now()
     WHERE id = $1
     RETURNING (SELECT photo_path FROM previous) AS previous_photo_path`,
    [id, ...values(input)],
  )) as unknown as { previous_photo_path: string | null }[];
  if (rows.length === 0) return null;

  const previous = rows[0].previous_photo_path;
  if (!previous || previous === input.photo_path) return { orphanPhotoPath: null };
  return { orphanPhotoPath: (await isPhotoUsed(previous)) ? null : previous };
}

/** Une photo peut être partagée entre une dégustation et une bouteille de la cave. */
async function isPhotoUsed(photoPath: string): Promise<boolean> {
  const [{ used }] = (await sql.query(
    `SELECT EXISTS (SELECT 1 FROM wine WHERE photo_path = $1)
         OR EXISTS (SELECT 1 FROM cellar_entry WHERE photo_path = $1) AS used`,
    [photoPath],
  )) as unknown as { used: boolean }[];
  return used;
}
