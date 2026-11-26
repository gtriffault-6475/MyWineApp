import "server-only";
import { connection } from "next/server";
import { sql } from "@/lib/db/client";

const ISO = (column: string) =>
  `to_char(${column} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS ${column}`;

/** Toutes les données, toutes colonnes, pour la sauvegarde (ordre stable). */
export async function exportAll() {
  await connection();
  const [caves, cellar_entries, wines] = await Promise.all([
    sql.query(
      `SELECT id, legacy_id, name, ${ISO("created_at")}, ${ISO("updated_at")}
       FROM cave ORDER BY created_at, id`,
    ),
    sql.query(
      `SELECT id, legacy_id, cave_id, name, producer, appellation, vintage, quantity,
              quantity_initial, purchase_date::text AS purchase_date,
              purchase_price::float8 AS purchase_price, optimal_from, optimal_to,
              storage_location, notes, photo_path, archived,
              ${ISO("created_at")}, ${ISO("updated_at")}
       FROM cellar_entry ORDER BY created_at, id`,
    ),
    sql.query(
      `SELECT id, legacy_id, cellar_entry_id, name, producer, appellation, vintage, score,
              location_type, restaurant_name, drunk_at::text AS drunk_at, food_pairing,
              photo_path, comment, companion, buy_again,
              ${ISO("created_at")}, ${ISO("updated_at")}
       FROM wine ORDER BY drunk_at, created_at, id`,
    ),
  ]);
  return { caves, cellar_entries, wines };
}
