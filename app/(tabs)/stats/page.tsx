import type { Metadata } from "next";
import { buyAgainPercent, getStats } from "@/lib/db/stats";
import { PageHeader } from "@/app/components/page-header";
import { EmptyState } from "@/app/components/empty-state";

export const metadata: Metadata = { title: "Statistiques · MyVine" };

/** Statistiques des dégustations (StatsScreen.tsx iOS). */
export default async function StatsPage() {
  const stats = await getStats();

  if (stats.total === 0) {
    return (
      <>
        <PageHeader title="Statistiques" />
        <EmptyState icon="📊" title="Pas encore de statistiques" message="Ajoutez des vins pour voir vos stats." />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Statistiques" />
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6 p-4 pb-12">
        <div className="grid grid-cols-3 gap-3">
          <Kpi emoji="🍷" value={stats.total.toString()} label="Vins dégustés" />
          <Kpi
            emoji="⭐"
            value={stats.avg_score !== null ? stats.avg_score.toFixed(1) : "–"}
            label="Note moyenne"
          />
          <Kpi emoji="↺" value={`${buyAgainPercent(stats)}%`} label="À racheter" />
        </div>

        {stats.top_appellations.length > 0 && (
          <TopList title="Top appellations" rows={stats.top_appellations} />
        )}
        {stats.top_producers.length > 0 && <TopList title="Top producteurs" rows={stats.top_producers} />}
      </div>
    </>
  );
}

function Kpi({ emoji, value, label }: { emoji: string; value: string; label: string }) {
  return (
    <div
      className="flex flex-col items-center gap-1 rounded-xl border border-border bg-surface p-4 text-center"
      style={{ boxShadow: "var(--shadow-sm)" }}
    >
      <span className="text-2xl" aria-hidden="true">
        {emoji}
      </span>
      <span className="kpi-value text-[22px]">{value}</span>
      <span className="text-xs text-text-muted">{label}</span>
    </div>
  );
}

function TopList({ title, rows }: { title: string; rows: { label: string; count: number }[] }) {
  const max = rows[0]?.count ?? 0;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-base font-semibold text-text">{title}</h2>
      <ol
        className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4"
        style={{ boxShadow: "var(--shadow-sm)" }}
      >
        {rows.map((row) => (
          <li key={row.label} className="flex items-center gap-3">
            <span className="w-[120px] shrink-0 truncate text-sm text-text">{row.label}</span>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-alt" aria-hidden="true">
              <span
                className="block h-full rounded-full bg-primary"
                style={{ width: `${max > 0 ? (row.count / max) * 100 : 0}%` }}
              />
            </span>
            <span className="w-6 shrink-0 text-right text-xs text-text-muted">{row.count}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
