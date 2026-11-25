import "server-only";
import { neon } from "@neondatabase/serverless";

/** Seule interface utilisée par lib/db : requête paramétrée ($1, $2…) → lignes. */
export interface Db {
  query(text: string, params?: unknown[]): Promise<Record<string, unknown>[]>;
}

function getConnectionString() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  return url;
}

function isLocalDatabase(url: string) {
  return /@(localhost|127\.0\.0\.1)[:/]/.test(url) || url.includes("host=/");
}

/**
 * Production : driver HTTP Neon (serverless). Développement avec un Postgres
 * local : `pg`, que le driver Neon ne sait pas joindre.
 */
function createClient(): Db {
  const url = getConnectionString();
  if (isLocalDatabase(url)) {
    let pool: import("pg").Pool | null = null;
    return {
      async query(text, params) {
        if (!pool) {
          const { Pool } = await import("pg");
          pool = new Pool({ connectionString: url, max: 3 });
        }
        return (await pool.query(text, params)).rows;
      },
    };
  }
  const neonSql = neon(url);
  return {
    query: (text, params) => neonSql.query(text, params) as Promise<Record<string, unknown>[]>,
  };
}

let client: Db | null = null;

/** Client créé à la première requête (pas au chargement du module, ni au build). */
export const sql: Db = {
  query: (text, params) => {
    client ??= createClient();
    return client.query(text, params);
  },
};
