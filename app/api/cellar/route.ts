import { NextResponse } from "next/server";
import { insertEntry } from "@/lib/db/cellar";
import { CellarInputSchema } from "@/lib/cellar/entry";
import { parseJson, withDb } from "@/lib/api";

/** Ajoute une bouteille à la cave. */
export async function POST(request: Request) {
  const body = await parseJson(request, CellarInputSchema);
  if ("response" in body) return body.response;
  const result = await withDb(() => insertEntry(body.data), "Impossible d'enregistrer la bouteille");
  if ("response" in result) return result.response;
  return NextResponse.json({ id: result.value }, { status: 201 });
}
