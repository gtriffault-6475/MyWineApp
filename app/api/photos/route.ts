import { NextResponse } from "next/server";
import { normalizeLabelPhoto, savePhoto } from "@/lib/photos/storage";

// Limite du corps de requête des fonctions Vercel : 4,5 Mo. Le téléphone
// compresse la photo avant l'envoi pour rester en dessous.
const MAX_UPLOAD_BYTES = 4_500_000;

/**
 * Envoi d'une photo d'étiquette (multipart, champ « photo »). La photo est
 * normalisée en JPEG puis stockée en privé. Retourne son chemin, à enregistrer
 * avec la dégustation.
 */
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const file = form?.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Aucune photo reçue." }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "Photo trop lourde (4,5 Mo maximum)." }, { status: 413 });
  }

  let jpeg: Buffer;
  try {
    jpeg = await normalizeLabelPhoto(Buffer.from(await file.arrayBuffer()));
  } catch {
    return NextResponse.json({ error: "Ce fichier n'est pas une image lisible." }, { status: 415 });
  }

  try {
    const photo_path = await savePhoto(jpeg);
    return NextResponse.json({ photo_path }, { status: 201 });
  } catch (error) {
    console.error("Échec d'enregistrement de la photo :", error);
    return NextResponse.json(
      { error: "Enregistrement de la photo impossible pour le moment. Réessayez." },
      { status: 503 },
    );
  }
}
