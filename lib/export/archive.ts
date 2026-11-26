import { strToU8, zipSync, type Zippable } from "fflate";

/**
 * Archive de sauvegarde « MyVine » : un ZIP contenant
 *   myvine-export.json  — format, date, compteurs, caves, bouteilles, dégustations
 *   photos/<nom>        — les photos d'étiquettes, telles que stockées
 * Le format est versionné pour pouvoir être relu par un futur import.
 */

export const EXPORT_FORMAT = "myvine-export";
export const EXPORT_VERSION = 1;

export interface ExportData {
  format: typeof EXPORT_FORMAT;
  version: typeof EXPORT_VERSION;
  exported_at: string;
  counts: { caves: number; cellar_entries: number; wines: number; photos: number };
  caves: Record<string, unknown>[];
  cellar_entries: Record<string, unknown>[];
  wines: Record<string, unknown>[];
  /** Chemins des photos utilisées (« wine-photos/<nom> »). */
  photos: string[];
}

/** Photos distinctes référencées par les bouteilles et les dégustations. */
export function referencedPhotos(
  rows: { photo_path?: unknown }[],
): string[] {
  const paths = new Set<string>();
  for (const row of rows) {
    if (typeof row.photo_path === "string" && row.photo_path) paths.add(row.photo_path);
  }
  return [...paths].sort();
}

/** Nom du fichier : myvine-sauvegarde-AAAA-MM-JJ.zip (date locale du téléphone). */
export function archiveFileName(now = new Date()): string {
  const d = (n: number) => String(n).padStart(2, "0");
  return `myvine-sauvegarde-${now.getFullYear()}-${d(now.getMonth() + 1)}-${d(now.getDate())}.zip`;
}

/**
 * Construit le ZIP. Les photos manquantes (erreur de téléchargement) sont
 * listées dans le JSON plutôt que de faire échouer toute la sauvegarde.
 */
export function buildArchive(
  data: ExportData,
  photos: Map<string, Uint8Array>,
): { zip: Uint8Array; missing: string[] } {
  const missing = data.photos.filter((p) => !photos.has(p));
  const json = JSON.stringify({ ...data, missing_photos: missing }, null, 2);
  const files: Zippable = {
    // JSON compressé ; photos JPEG déjà compressées : simplement stockées.
    "myvine-export.json": [strToU8(json), { level: 6 }],
  };
  for (const [path, bytes] of photos) {
    const name = path.split("/").pop();
    if (name) files[`photos/${name}`] = [bytes, { level: 0 }];
  }
  return { zip: zipSync(files), missing };
}
