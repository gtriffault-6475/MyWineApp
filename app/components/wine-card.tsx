import Link from "next/link";
import {
  formatShortDate,
  locationLabel,
  photoUrl,
  wineSubtitle,
  wineTitle,
  type Wine,
} from "@/lib/wines/wine";
import { StarRating } from "./star-rating";
import { WinePhoto } from "./wine-photo";

/** Carte d'une dégustation dans la liste (reprise de WineCard.tsx iOS). */
export function WineCard({ wine }: { wine: Wine }) {
  const subtitle = wineSubtitle(wine);
  const date = formatShortDate(wine.drunk_at);

  return (
    <Link
      href={`/degustations/${wine.id}`}
      className="mx-4 my-1 flex h-[74px] overflow-hidden rounded-xl border border-border bg-surface active:opacity-80"
      style={{ boxShadow: "var(--shadow-sm)" }}
    >
      <WinePhoto
        src={photoUrl(wine.photo_path, 160)}
        alt=""
        className="h-full w-[66px] shrink-0"
        emojiSize={24}
      />
      <div className="flex min-w-0 flex-1 flex-col justify-between px-3 py-2">
        <div className="flex items-center gap-1">
          <span className="wine-name flex-1 truncate text-sm text-text">{wineTitle(wine)}</span>
          {wine.buy_again && (
            <span className="text-sm text-success" aria-label="À racheter">
              ↺
            </span>
          )}
        </div>
        {subtitle && <span className="truncate text-xs text-text-muted">{subtitle}</span>}
        <div className="flex min-w-0 items-center gap-1 text-xs text-text-light">
          {wine.score !== null ? (
            <StarRating score={wine.score} size={12} />
          ) : (
            <span>—</span>
          )}
          <span>·</span>
          <span className="truncate">{locationLabel(wine)}</span>
          {date && (
            <>
              <span>·</span>
              <span className="shrink-0">{date}</span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}
