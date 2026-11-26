import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getEntry } from "@/lib/db/cellar";
import { getCave } from "@/lib/db/caves";
import { listWinesForEntry } from "@/lib/db/wines";
import { isUuid } from "@/lib/validation/uuid";
import {
  APOGEE_COLORS,
  APOGEE_LABELS,
  apogeeLabel,
  apogeeStatus,
  purchaseSummary,
} from "@/lib/cellar/entry";
import { photoUrl, wineSubtitle } from "@/lib/wines/wine";
import { PageHeader } from "@/app/components/page-header";
import { WinePhoto } from "@/app/components/wine-photo";
import { WineCard } from "@/app/components/wine-card";
import { BottleActions } from "./bottle-actions";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const entry = isUuid(id) ? await getEntry(id) : null;
  return { title: entry ? `${entry.name} · MyVine` : "MyVine" };
}

/** Fiche d'une bouteille en cave (CellarDetailScreen.tsx iOS). */
export default async function BottlePage({ params }: Props) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [entry, linkedWines] = await Promise.all([getEntry(id), listWinesForEntry(id)]);
  if (!entry) notFound();
  const cave = entry.cave_id ? await getCave(entry.cave_id) : null;
  const back = cave
    ? { href: `/caves/${cave.id}`, label: cave.name }
    : { href: "/caves", label: "Mes caves" };

  const subtitle = wineSubtitle(entry);
  const label = apogeeLabel(entry);
  const status = apogeeStatus(entry);
  const purchase = purchaseSummary(entry);
  const src = photoUrl(entry.photo_path, 800);

  return (
    <div className="min-h-dvh pb-12">
      <PageHeader
        title={entry.name}
        back={back}
        actions={
          <Link href={`/bouteilles/${entry.id}/modifier`} className="text-base font-medium text-primary">
            Modifier
          </Link>
        }
      />

      <div className="mx-auto max-w-xl">
        <WinePhoto
          src={src}
          alt={`Étiquette de ${entry.name}`}
          className={src ? "h-[260px] w-full" : "h-[200px] w-full bg-surface"}
          emojiSize={64}
          placeholder="🍾"
          eager
        />

        <div className="flex flex-col gap-4 p-6">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="wine-name text-[28px] leading-[34px] text-text">
                {entry.name}
                {entry.vintage ? ` ${entry.vintage}` : ""}
              </h2>
              {subtitle && <p className="mt-1 text-base text-text-muted">{subtitle}</p>}
            </div>
            <div className="flex min-w-14 flex-col items-center rounded-xl bg-primary px-3 py-2 text-white">
              <span className="text-[22px] leading-7 font-bold">{entry.quantity}</span>
              <span className="text-[10px] font-medium text-white/80">
                {entry.quantity > 1 ? "bouteilles" : "bouteille"}
              </span>
            </div>
          </div>

          {(label || entry.storage_location) && (
            <div className="-mt-1 flex flex-wrap gap-2">
              {label && (
                <span
                  className="rounded-3xl border bg-surface px-3 py-1 text-xs font-medium"
                  style={{ borderColor: APOGEE_COLORS[status], color: APOGEE_COLORS[status] }}
                >
                  {APOGEE_LABELS[status] ? `${APOGEE_LABELS[status]} · ` : ""}
                  {label}
                </span>
              )}
              {entry.storage_location && (
                <span className="rounded-3xl border border-border bg-surface px-3 py-1 text-xs font-medium text-text">
                  📦 {entry.storage_location}
                </span>
              )}
            </div>
          )}

          {purchase && <InfoBlock label="Achat" value={purchase} />}
          {entry.notes && <InfoBlock label="Notes" value={entry.notes} />}

          <BottleActions id={entry.id} name={entry.name} quantity={entry.quantity} backHref={back.href} />
        </div>

        {linkedWines.length > 0 && (
          <section className="mt-4">
            <h3 className="mb-2 px-6 text-lg font-semibold text-text">
              Dégustations ({linkedWines.length})
            </h3>
            <ul>
              {linkedWines.map((wine) => (
                <li key={wine.id}>
                  <WineCard wine={wine} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <section className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-4">
      <h3 className="text-xs font-semibold tracking-wide text-text-muted uppercase">{label}</h3>
      <p className="text-base leading-6 whitespace-pre-line text-text">{value}</p>
    </section>
  );
}
