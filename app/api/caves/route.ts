import { NextResponse } from "next/server";
import { CaveLimitError, insertCave } from "@/lib/db/caves";
import { CaveNameSchema, MAX_CAVES } from "@/lib/cellar/entry";
import { apiError, parseJson } from "@/lib/api";

/** Crée une cave (« Nouvelle cave » iOS). */
export async function POST(request: Request) {
  const body = await parseJson(request, CaveNameSchema);
  if ("response" in body) return body.response;
  try {
    const id = await insertCave(body.data.name);
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    if (error instanceof CaveLimitError) {
      return apiError(`${MAX_CAVES} caves maximum.`, 409);
    }
    console.error("Échec de création de la cave :", error);
    return apiError("Impossible de créer la cave pour le moment. Réessayez.", 503);
  }
}
