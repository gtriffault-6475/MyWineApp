import { NextResponse } from "next/server";
import { deleteSession } from "@/lib/auth/session";

/** Déconnexion : supprime le cookie de session. */
export async function POST() {
  await deleteSession();
  return NextResponse.json({ ok: true });
}
