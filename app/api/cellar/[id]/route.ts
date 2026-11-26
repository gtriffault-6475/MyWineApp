import { NextResponse } from "next/server";
import { deleteEntry, updateEntry } from "@/lib/db/cellar";
import { deletePhotoQuietly } from "@/lib/photos/storage";
import { CellarInputSchema } from "@/lib/cellar/entry";
import { apiError, parseJson, withDb } from "@/lib/api";
import { isUuid } from "@/lib/validation/uuid";

type Context = { params: Promise<{ id: string }> };
const NOT_FOUND = () => apiError("Bouteille introuvable.", 404);

/** Modifie une bouteille ; supprime l'ancienne photo si elle a été remplacée. */
export async function PUT(request: Request, { params }: Context) {
  const { id } = await params;
  if (!isUuid(id)) return NOT_FOUND();
  const body = await parseJson(request, CellarInputSchema);
  if ("response" in body) return body.response;
  const result = await withDb(() => updateEntry(id, body.data), "Impossible d'enregistrer la bouteille");
  if ("response" in result) return result.response;
  if (!result.value) return NOT_FOUND();
  await deletePhotoQuietly(result.value.orphanPhotoPath);
  return NextResponse.json({ id });
}

/** Supprime une bouteille de la cave (ses dégustations sont conservées). */
export async function DELETE(_request: Request, { params }: Context) {
  const { id } = await params;
  if (!isUuid(id)) return NOT_FOUND();
  const result = await withDb(() => deleteEntry(id), "Impossible de supprimer la bouteille");
  if ("response" in result) return result.response;
  if (!result.value) return NOT_FOUND();
  await deletePhotoQuietly(result.value.orphanPhotoPath);
  return NextResponse.json({ ok: true });
}
