import { NextResponse } from "next/server";
import { insertWine } from "@/lib/db/wines";
import { WineInputSchema } from "@/lib/wines/input";

/** Crée une dégustation à partir du formulaire. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = WineInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." },
      { status: 400 },
    );
  }

  try {
    const id = await insertWine(parsed.data);
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    console.error("Échec de création de la dégustation :", error);
    return NextResponse.json(
      { error: "Impossible d'enregistrer le vin pour le moment. Réessayez." },
      { status: 503 },
    );
  }
}
