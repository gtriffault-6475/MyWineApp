import "server-only";
import { connection } from "next/server";
import { sql } from "@/lib/db/client";
import type { Wine } from "@/lib/wines/wine";

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

  const [{ used }] = (await sql.query(
    `SELECT EXISTS (SELECT 1 FROM wine WHERE photo_path = $1)
         OR EXISTS (SELECT 1 FROM cellar_entry WHERE photo_path = $1) AS used`,
    [photoPath],
  )) as unknown as { used: boolean }[];
  return { orphanPhotoPath: used ? null : photoPath };
}
