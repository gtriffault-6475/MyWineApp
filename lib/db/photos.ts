import "server-only";
import { sql } from "@/lib/db/client";

/** Une photo peut être partagée entre une dégustation et une bouteille de la cave. */
export async function isPhotoUsed(photoPath: string): Promise<boolean> {
  const [{ used }] = (await sql.query(
    `SELECT EXISTS (SELECT 1 FROM wine WHERE photo_path = $1)
         OR EXISTS (SELECT 1 FROM cellar_entry WHERE photo_path = $1) AS used`,
    [photoPath],
  )) as unknown as { used: boolean }[];
  return used;
}

/** La photo `photoPath` si elle n'est plus utilisée nulle part, sinon null. */
export async function orphanOrNull(photoPath: string | null): Promise<string | null> {
  if (!photoPath) return null;
  return (await isPhotoUsed(photoPath)) ? null : photoPath;
}
