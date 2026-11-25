import "server-only";

function requireAppPassword(): string {
  const expected = process.env.APP_PASSWORD;
  if (!expected) {
    throw new Error("APP_PASSWORD is not set");
  }
  return expected;
}

/**
 * Comparaison directe (pas de temps constant) : mot de passe partagé unique,
 * usage hobby mono-utilisateur, pas de bruteforce ciblé à craindre (NFR6).
 */
export function verifyPassword(submitted: string): boolean {
  return submitted === requireAppPassword();
}

/** Valide APP_PASSWORD au démarrage plutôt qu'au premier login (voir instrumentation.ts). */
export function assertAppPasswordConfigured(): void {
  requireAppPassword();
}
