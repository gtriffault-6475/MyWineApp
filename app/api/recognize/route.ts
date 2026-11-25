import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { LabelRecognitionError, recognizeWineLabel } from "@/lib/clients/label-recognition";
import { normalizeLabelPhoto, PHOTO_PATH, readPhoto } from "@/lib/photos/storage";

// Taille recommandée pour la vision de Claude : au-delà, l'image est réduite
// côté API sans gain de lecture.
const VISION_MAX_SIDE = 1568;

/** Analyse l'étiquette d'une photo déjà envoyée et propose nom, producteur… */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const photoPath = typeof body?.photo_path === "string" ? body.photo_path : "";
  if (!PHOTO_PATH.test(photoPath)) {
    return NextResponse.json({ error: "Photo introuvable." }, { status: 404 });
  }

  let photo: Buffer | null;
  try {
    photo = await readPhoto(photoPath);
  } catch (error) {
    console.error("Échec de lecture de la photo à analyser :", error);
    return NextResponse.json({ error: "Photo indisponible pour le moment." }, { status: 503 });
  }
  if (!photo) return NextResponse.json({ error: "Photo introuvable." }, { status: 404 });

  try {
    const jpeg = await normalizeLabelPhoto(photo, VISION_MAX_SIDE);
    return NextResponse.json(await recognizeWineLabel(jpeg));
  } catch (error) {
    if (error instanceof LabelRecognitionError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    console.error("Échec de la reconnaissance d'étiquette :", error);
    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: "Trop de demandes d'analyse, réessayez dans un instant." },
        { status: 429 },
      );
    }
    if (error instanceof Anthropic.AuthenticationError) {
      return NextResponse.json(
        { error: "Clé Anthropic invalide : vérifiez ANTHROPIC_API_KEY dans Vercel." },
        { status: 502 },
      );
    }
    return NextResponse.json({ error: "Analyse impossible pour le moment." }, { status: 502 });
  }
}
