import { NextResponse } from "next/server";
import { get } from "@vercel/blob";

// Seul dossier servi : les photos d'étiquettes (pas d'accès arbitraire au store).
const PHOTO_PATH = /^wine-photos\/[A-Za-z0-9][A-Za-z0-9._-]*$/;

// Largeurs autorisées (px) : liste fermée pour éviter des redimensionnements
// arbitraires. 160 = miniature de liste, 800 = fiche détail.
const PHOTO_WIDTHS = new Set([160, 800]);

const SAFE_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

// Un chemin de photo n'est jamais réécrit (nom unique à la création), le
// navigateur peut donc garder la photo en cache indéfiniment.
const CACHE_HEADERS = {
  "Cache-Control": "private, max-age=31536000, immutable",
  "X-Content-Type-Options": "nosniff",
};

/**
 * Streame une photo depuis Vercel Blob (accès privé) — jamais l'URL Blob brute
 * côté client. `?w=160|800` renvoie une version redimensionnée en WebP.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const pathname = path.join("/");
  if (!PHOTO_PATH.test(pathname)) {
    return NextResponse.json({ error: "Photo introuvable." }, { status: 404 });
  }

  const widthParam = new URL(request.url).searchParams.get("w");
  const width = widthParam === null ? null : Number(widthParam);
  if (width !== null && !PHOTO_WIDTHS.has(width)) {
    return NextResponse.json({ error: "Largeur non prise en charge." }, { status: 400 });
  }

  let blob;
  try {
    blob = await get(pathname, { access: "private" });
  } catch (error) {
    console.error("Échec de lecture du blob privé :", error);
    return NextResponse.json(
      { error: "Service photo temporairement indisponible." },
      { status: 503 },
    );
  }
  if (!blob || blob.statusCode !== 200) {
    return NextResponse.json(
      { error: blob ? "Service photo temporairement indisponible." : "Photo introuvable." },
      { status: blob ? 503 : 404 },
    );
  }

  const contentType = blob.blob.contentType;
  if (!SAFE_IMAGE_TYPES.has(contentType)) {
    return NextResponse.json({ error: "Format de photo non pris en charge." }, { status: 415 });
  }

  if (width === null) {
    return new Response(blob.stream, {
      headers: { "Content-Type": contentType, ...CACHE_HEADERS },
    });
  }

  try {
    const { default: sharp } = await import("sharp");
    const input = Buffer.from(await new Response(blob.stream).arrayBuffer());
    const output = await sharp(input)
      .rotate() // applique l'orientation EXIF des photos d'iPhone
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
    return new Response(new Uint8Array(output), {
      headers: { "Content-Type": "image/webp", ...CACHE_HEADERS },
    });
  } catch (error) {
    console.error("Échec du redimensionnement :", error);
    return NextResponse.json({ error: "Photo illisible." }, { status: 422 });
  }
}
