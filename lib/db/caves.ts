import "server-only";
import { connection } from "next/server";
import { sql } from "@/lib/db/client";
import { MAX_CAVES, type Cave } from "@/lib/cellar/entry";

const CAVE_COLUMNS = `
  c.id, c.name,
  (SELECT count(*)::int FROM cellar_entry e WHERE e.cave_id = c.id AND NOT e.archived) AS bottle_count
`;

/** Caves dans l'ordre de création (comme iOS), avec leur nombre de bouteilles. */
export async function listCaves(): Promise<Cave[]> {
  await connection();
  return (await sql.query(
    `SELECT ${CAVE_COLUMNS} FROM cave c ORDER BY c.created_at, c.legacy_id NULLS LAST`,
  )) as unknown as Cave[];
}

export async function getCave(id: string): Promise<Cave | null> {
  await connection();
  const rows = (await sql.query(`SELECT ${CAVE_COLUMNS} FROM cave c WHERE c.id = $1`, [
    id,
  ])) as unknown as Cave[];
  return rows[0] ?? null;
}

export class CaveLimitError extends Error {}
export class CaveNotEmptyError extends Error {
  constructor(readonly bottleCount: number) {
    super("Cave non vide");
  }
}

/** Crée une cave (5 au maximum, comme iOS). */
export async function insertCave(name: string): Promise<string> {
  const rows = (await sql.query(
    `INSERT INTO cave (name)
     SELECT $1 WHERE (SELECT count(*) FROM cave) < $2
     RETURNING id`,
    [name, MAX_CAVES],
  )) as unknown as { id: string }[];
  if (rows.length === 0) throw new CaveLimitError();
  return rows[0].id;
}

export async function renameCave(id: string, name: string): Promise<boolean> {
  const rows = await sql.query(
    `UPDATE cave SET name = $2, updated_at = now() WHERE id = $1 RETURNING id`,
    [id, name],
  );
  return rows.length > 0;
}

/**
 * Supprime une cave vide (refus si elle contient des bouteilles, comme iOS).
 * Les bouteilles archivées qui y étaient rangées perdent simplement leur cave.
 */
export async function deleteCave(id: string): Promise<boolean> {
  const rows = (await sql.query(
    `WITH target AS (
       SELECT id, (SELECT count(*)::int FROM cellar_entry e
                   WHERE e.cave_id = cave.id AND NOT e.archived) AS bottles
       FROM cave WHERE id = $1
     ), deleted AS (
       DELETE FROM cave WHERE id IN (SELECT id FROM target WHERE bottles = 0) RETURNING id
     )
     SELECT (SELECT bottles FROM target) AS bottles, (SELECT count(*)::int FROM deleted) AS deleted`,
    [id],
  )) as unknown as { bottles: number | null; deleted: number }[];
  const { bottles, deleted } = rows[0];
  if (bottles === null) return false;
  if (deleted === 0) throw new CaveNotEmptyError(bottles);
  return true;
}
