import { NextResponse } from "next/server";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";

  if (!password || !verifyPassword(password)) {
    return NextResponse.json(
      { error: "Mot de passe incorrect." },
      { status: 401 },
    );
  }

  await createSession();
  return NextResponse.json({ ok: true });
}
