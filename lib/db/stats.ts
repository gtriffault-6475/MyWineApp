import "server-only";
import { connection } from "next/server";
import { sql } from "@/lib/db/client";

export interface WineStats {
  total: number;
  avg_score: number | null;
  buy_again_count: number;
  top_appellations: { label: string; count: number }[];
  top_producers: { label: string; count: number }[];
}

/** Statistiques des dégustations (getStats iOS) : totaux et top 5. */
export async function getStats(): Promise<WineStats> {
  await connection();
  const top = (column: "appellation" | "producer") =>
    sql.query(
      `SELECT ${column} AS label, count(*)::int AS count FROM wine
       WHERE ${column} IS NOT NULL AND ${column} <> ''
       GROUP BY ${column} ORDER BY count DESC, ${column} ASC LIMIT 5`,
    ) as unknown as Promise<{ label: string; count: number }[]>;

  const [totals, top_appellations, top_producers] = await Promise.all([
    sql.query(
      `SELECT count(*)::int AS total, avg(score)::float8 AS avg_score,
              count(*) FILTER (WHERE buy_again)::int AS buy_again_count
       FROM wine`,
    ) as unknown as Promise<{ total: number; avg_score: number | null; buy_again_count: number }[]>,
    top("appellation"),
    top("producer"),
  ]);

  return { ...totals[0], top_appellations, top_producers };
}

/** « À racheter » en pourcentage arrondi, comme iOS. */
export function buyAgainPercent(stats: Pick<WineStats, "total" | "buy_again_count">): number {
  return stats.total > 0 ? Math.round((stats.buy_again_count / stats.total) * 100) : 0;
}
