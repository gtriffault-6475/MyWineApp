import { NextResponse } from "next/server";
import type { z } from "zod";

/** Réponse d'erreur JSON homogène ({ error }) pour les routes API. */
export function apiError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/** Lit et valide un corps JSON ; renvoie la donnée ou une réponse 400. */
export async function parseJson<S extends z.ZodType>(
  request: Request,
  schema: S,
): Promise<{ data: z.output<S> } | { response: NextResponse }> {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return { response: apiError(parsed.error.issues[0]?.message ?? "Formulaire invalide.", 400) };
  }
  return { data: parsed.data };
}

/** Exécute une écriture en base ; une panne donne un 503 lisible. */
export async function withDb<T>(
  action: () => Promise<T>,
  failure: string,
): Promise<{ value: T } | { response: NextResponse }> {
  try {
    return { value: await action() };
  } catch (error) {
    console.error(`${failure} :`, error);
    return { response: apiError(`${failure} pour le moment. Réessayez.`, 503) };
  }
}
