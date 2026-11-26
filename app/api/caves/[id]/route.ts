import { NextResponse } from "next/server";
import { CaveNotEmptyError, deleteCave, renameCave } from "@/lib/db/caves";
import { apiError, parseJson, withDb } from "@/lib/api";
import { isUuid } from "@/lib/validation/uuid";
import { CaveNameSchema } from "@/lib/cellar/entry";

type Context = { params: Promise<{ id: string }> };
const NOT_FOUND = () => apiError("Cave introuvable.", 404);

/** Renomme une cave. */
export async function PATCH(request: Request, { params }: Context) {
  const { id } = await params;
  if (!isUuid(id)) return NOT_FOUND();
  const body = await parseJson(request, CaveNameSchema);
  if ("response" in body) return body.response;
  const result = await withDb(() => renameCave(id, body.data.name), "Impossible de renommer la cave");
  if ("response" in result) return result.response;
  return result.value ? NextResponse.json({ id }) : NOT_FOUND();
}

/** Supprime une cave vide (même message qu'iOS sinon). */
export async function DELETE(_request: Request, { params }: Context) {
  const { id } = await params;
  if (!isUuid(id)) return NOT_FOUND();
  try {
    return (await deleteCave(id)) ? NextResponse.json({ ok: true }) : NOT_FOUND();
  } catch (error) {
    if (error instanceof CaveNotEmptyError) {
      const n = error.bottleCount;
      return apiError(
        `Impossible de supprimer cette cave car elle contient ${n} bouteille${n > 1 ? "s" : ""}.`,
        409,
      );
    }
    console.error("Échec de suppression de la cave :", error);
    return apiError("Impossible de supprimer la cave pour le moment. Réessayez.", 503);
  }
}
