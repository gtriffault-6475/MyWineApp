import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getWineById } from "@/lib/db/wines";
import { isUuid } from "@/lib/validation/uuid";
import {
  formatLongDate,
  locationLabel,
  photoUrl,
  wineSubtitle,
  wineTitle,
} from "@/lib/wines/wine";
import { PageHeader } from "@/app/components/page-header";
import { StarRating } from "@/app/components/star-rating";
import { WinePhoto } from "@/app/components/wine-photo";
import { DeleteWineButton } from "./delete-wine-button";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const wine = isUuid(id) ? await getWineById(id) : null;
  return { title: wine ? `${wineTitle(wine)} · MyVine` : "MyVine" };
}

/** Fiche d'une dégustation (reprise de WineDetailScreen.tsx iOS). */
export default async function WineDetailPage({ params }: Props) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const wine = await getWineById(id);
  if (!wine) notFound();

  const subtitle = wineSubtitle(wine);
  const src = photoUrl(wine.photo_path, 800);

  return (
    <div className="min-h-dvh pb-12">
      <PageHeader
        title={wine.name}
        back={{ href: "/degustations", label: "Dégustations" }}
        actions={
          <>
            <Link
              href={`/degustations/${wine.id}/modifier`}
              className="text-base font-medium text-primary"
            >
              Modifier
            </Link>
            <DeleteWineButton id={wine.id} name={wine.name} />
          </>
        }
      />

      <div className="mx-auto max-w-xl">
        <WinePhoto
          src={src}
          alt={`Étiquette de ${wineTitle(wine)}`}
          className={src ? "h-[280px] w-full" : "h-[200px] w-full bg-surface"}
          emojiSize={64}
          eager
        />

        <div className="flex flex-col gap-4 p-6">
          <div>
            <h2 className="wine-name text-[28px] leading-[34px] text-text">{wineTitle(wine)}</h2>
            {subtitle && <p className="mt-1 text-base text-text-muted">{subtitle}</p>}
          </div>

          {wine.score !== null && <StarRating score={wine.score} size={22} />}

          <div className="flex flex-wrap gap-2">
            <Chip icon="📍" label={locationLabel(wine)} />
            <Chip icon="📅" label={formatLongDate(wine.drunk_at)} />
            {wine.buy_again && <Chip icon="✓" label="À racheter" highlight />}
          </div>

          {wine.companion && <InfoBlock label="Avec qui" value={wine.companion} />}
          {wine.food_pairing && <InfoBlock label="Accord mets-vins" value={wine.food_pairing} />}
          {wine.comment && <InfoBlock label="Commentaire" value={wine.comment} />}
        </div>
      </div>
    </div>
  );
}

function Chip({ icon, label, highlight }: { icon: string; label: string; highlight?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-3xl border px-3 py-1 text-xs font-medium ${
        highlight ? "text-success" : "border-border bg-surface text-text"
      }`}
      style={
        highlight
          ? {
              backgroundColor: "color-mix(in srgb, var(--success) 13%, transparent)",
              borderColor: "color-mix(in srgb, var(--success) 33%, transparent)",
            }
          : undefined
      }
    >
      <span className="text-[13px]" aria-hidden="true">
        {icon}
      </span>
      {label}
    </span>
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
