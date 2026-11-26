import Link from "next/link";
import {
  APOGEE_COLORS,
  APOGEE_ICONS,
  apogeeLabel,
  apogeeStatus,
  type CellarEntry,
} from "@/lib/cellar/entry";
import { photoUrl, wineSubtitle } from "@/lib/wines/wine";
import { WinePhoto } from "@/app/components/wine-photo";

/** Carte d'une bouteille en cave (CellarCard.tsx iOS). */
export function CellarCard({ entry }: { entry: CellarEntry }) {
  const subtitle = wineSubtitle(entry);
  const label = apogeeLabel(entry);
  const status = apogeeStatus(entry);

  return (
    <Link
      href={`/bouteilles/${entry.id}`}
      className="mx-4 my-1 flex h-[74px] overflow-hidden rounded-xl border border-border bg-surface active:opacity-80"
      style={{ boxShadow: "var(--shadow-sm)" }}
    >
      <WinePhoto
        src={photoUrl(entry.photo_path, 160)}
        alt=""
        className="h-full w-[66px] shrink-0"
        emojiSize={24}
        placeholder="🍾"
      />
      <div className="flex min-w-0 flex-1 flex-col justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="wine-name flex-1 truncate text-sm text-text">
            {entry.name}
            {entry.vintage ? ` ${entry.vintage}` : ""}
          </span>
          <span
            className="flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-primary px-2 text-xs font-bold text-white"
            aria-label={`${entry.quantity} en cave`}
          >
            {entry.quantity}
          </span>
        </div>
        {subtitle && <span className="truncate text-xs text-text-muted">{subtitle}</span>}
        <div className="flex min-w-0 items-center gap-1 text-xs">
          {label && (
            <span className="truncate font-medium" style={{ color: APOGEE_COLORS[status] }}>
              {APOGEE_ICONS[status] ? `${APOGEE_ICONS[status]} ` : ""}
              {label}
            </span>
          )}
          {label && entry.storage_location && <span className="text-text-light">·</span>}
          {entry.storage_location && (
            <span className="truncate text-text-light">📦 {entry.storage_location}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
