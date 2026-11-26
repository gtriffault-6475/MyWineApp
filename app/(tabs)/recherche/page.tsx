import type { Metadata } from "next";
import { searchWines } from "@/lib/db/wines";
import { filtersFromParams, toURLSearchParams } from "@/lib/wines/search";
import { EmptyState } from "@/app/components/empty-state";
import { WineCard } from "@/app/components/wine-card";
import { SearchControls } from "@/app/components/search/search-controls";

export const metadata: Metadata = { title: "Rechercher · MyVine" };

/** Recherche de dégustations avec filtres et tris (SearchScreen.tsx iOS). */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = filtersFromParams(toURLSearchParams(await searchParams));
  const wines = await searchWines(filters);

  return (
    <SearchControls initial={filters}>
      {wines.length === 0 ? (
        <div className="flex min-h-[60dvh] flex-col">
          <EmptyState title="Aucun résultat" message="Essayez d'autres critères de recherche." />
        </div>
      ) : (
        <ul className="mx-auto w-full max-w-xl py-3">
          {wines.map((wine) => (
            <li key={wine.id}>
              <WineCard wine={wine} />
            </li>
          ))}
        </ul>
      )}
    </SearchControls>
  );
}
