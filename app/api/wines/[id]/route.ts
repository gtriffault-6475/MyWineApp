import { NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { deleteWine } from "@/lib/db/wines";
import { isUuid } from "@/lib/validation/uuid";

/** Supprime une dégustation, et sa photo si plus aucune fiche ne l'utilise. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Dégustation introuvable." }, { status: 404 });
  }

  let result;
  try {
    result = await deleteWine(id);
  } catch (error) {
    console.error("Échec de suppression de la dégustation :", error);
    return NextResponse.json(
      { error: "Suppression impossible pour le moment. Réessayez." },
      { status: 503 },
    );
  }
  if (!result) {
    return NextResponse.json({ error: "Dégustation introuvable." }, { status: 404 });
  }

  if (result.orphanPhotoPath) {
    // Best-effort, comme l'app iOS : la fiche est supprimée même si la photo
    // reste dans le stockage (simple fichier orphelin, sans impact visible).
    await del(result.orphanPhotoPath).catch((error) => {
      console.error("Photo non supprimée du stockage :", error);
    });
  }

  return NextResponse.json({ ok: true });
}
