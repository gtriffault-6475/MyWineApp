/**
 * Connexion à la base pour les scripts lancés depuis le Mac (import, vérification).
 *
 * Neon : pilote officiel @neondatabase/serverless en WebSocket sur HTTPS
 * (port 443). Le port PostgreSQL standard (5432) est souvent bloqué par les
 * réseaux d'entreprise, VPN ou Wi-Fi publics ; le 443 passe partout.
 * Base locale (développement, tests) : `pg` classique.
 *
 * Les deux clients exposent la même API (connect / query / end) : le reste
 * du code n'a pas à savoir lequel est utilisé.
 */
import pg from "pg";

export function isLocalDatabase(url) {
  return /@(localhost|127\.0\.0\.1)[:/]/.test(url) || url.includes("host=/");
}

/** Crée et connecte un client ; `transport` décrit le canal pour les messages. */
export async function connectDatabase(connectionString, { timeoutMs = 15_000 } = {}) {
  if (isLocalDatabase(connectionString)) {
    const client = new pg.Client({ connectionString, connectionTimeoutMillis: timeoutMs });
    await client.connect();
    return { client, transport: "PostgreSQL local" };
  }

  const { Client, neonConfig } = await import("@neondatabase/serverless");
  const { default: ws } = await import("ws");
  neonConfig.webSocketConstructor = ws;
  const client = new Client({ connectionString, connectionTimeoutMillis: timeoutMs });
  await client.connect();
  return { client, transport: "Neon via WebSocket (HTTPS, port 443)" };
}
