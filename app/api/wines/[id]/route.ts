import { NextResponse } from "next/server";
import { deleteWine, updateWine } from "@/lib/db/wines";
import { deletePhotoQuietly } from "@/lib/photos/storage";
import { WineInputSchema } from "@/lib/wines/input";
import { isUuid } from "@/lib/validation/uuid";

type Context = { params: Promise<{ id: string }> };

const NOT_FOUND = () =>
  NextResponse.json({ error: "Dégustation introuvable." }, { status: 404 });

/** Modifie une dégustation ; supprime l'ancienne photo si elle a été remplacée. */
export async function PUT(request: Request, { params }: Context) {
  const { id } = await params;
  if (!isUuid(id)) return NOT_FOUND();

  const body = await request.json().catch(() => null);
  const parsed = WineInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." },
      { status: 400 },
    );
  }

  let result;
  try {
    result = await updateWine(id, parsed.data);
  } catch (error) {
    console.error("Échec de mise à jour de la dégustation :", error);
    return NextResponse.json(
      { error: "Impossible de mettre à jour le vin pour le moment. Réessayez." },
      { status: 503 },
    );
  }
  if (!result) return NOT_FOUND();

  await deletePhotoQuietly(result.orphanPhotoPath);
  return NextResponse.json({ id });
}

/** Supprime une dégustation, et sa photo si plus aucune fiche ne l'utilise. */
export async function DELETE(_request: Request, { params }: Context) {
  const { id } = await params;
  if (!isUuid(id)) return NOT_FOUND();

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
  if (!result) return NOT_FOUND();

  // Best-effort, comme l'app iOS : la fiche est supprimée même si la photo
  // reste dans le stockage (simple fichier orphelin, sans impact visible).
  await deletePhotoQuietly(result.orphanPhotoPath);
  return NextResponse.json({ ok: true });
}
