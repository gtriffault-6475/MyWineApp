import "server-only";
import { randomUUID } from "node:crypto";
import { del, get, put } from "@vercel/blob";

export const PHOTOS_DIR = "wine-photos";
export const PHOTO_PATH = /^wine-photos\/[A-Za-z0-9][A-Za-z0-9._-]*$/;

const MAX_SIDE = 2000;

/**
 * Normalise une photo d'étiquette : orientation EXIF appliquée, 2000 px max,
 * JPEG. Accepte tout format lisible par sharp (JPEG, PNG, WebP, HEIC…).
 * Lève une erreur si le fichier n'est pas une image.
 */
export async function normalizeLabelPhoto(input: Buffer, maxSide = MAX_SIDE): Promise<Buffer> {
  const { default: sharp } = await import("sharp");
  return sharp(input, { failOn: "error" })
    .rotate()
    .resize({ width: maxSide, height: maxSide, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
}

/** Enregistre une photo (déjà normalisée) dans Blob privé, sous un nom unique. */
export async function savePhoto(jpeg: Buffer): Promise<string> {
  const pathname = `${PHOTOS_DIR}/${randomUUID()}.jpg`;
  await put(pathname, jpeg, {
    access: "private",
    contentType: "image/jpeg",
    addRandomSuffix: false,
  });
  return pathname;
}

/** Lit une photo privée ; `null` si elle n'existe pas. */
export async function readPhoto(pathname: string): Promise<Buffer | null> {
  const blob = await get(pathname, { access: "private" });
  if (!blob) return null;
  if (blob.statusCode !== 200) throw new Error(`Lecture photo : statut ${blob.statusCode}`);
  return Buffer.from(await new Response(blob.stream).arrayBuffer());
}

/** Suppression best-effort (comme iOS) : un échec laisse juste un fichier orphelin. */
export async function deletePhotoQuietly(pathname: string | null): Promise<void> {
  if (!pathname) return;
  await del(pathname).catch((error) => {
    console.error("Photo non supprimée du stockage :", error);
  });
}
