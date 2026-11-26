import { NextResponse } from "next/server";
import { openBottle } from "@/lib/db/cellar";
import { apiError, withDb } from "@/lib/api";
import { isUuid } from "@/lib/validation/uuid";

/** « Ouvrir une bouteille » : décompte une bouteille (archivée à la dernière). */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return apiError("Bouteille introuvable.", 404);
  const result = await withDb(() => openBottle(id), "Impossible de mettre à jour la cave");
  if ("response" in result) return result.response;
  if (!result.value) return apiError("Bouteille introuvable.", 404);
  return NextResponse.json(result.value);
}
