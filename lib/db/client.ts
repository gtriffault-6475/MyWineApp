import "server-only";
import { neon } from "@neondatabase/serverless";

function getConnectionString() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  return url;
}

/** Client runtime (requêtes applicatives) — pas utilisé pour les migrations, voir node-pg-migrate. */
export const sql = neon(getConnectionString());
