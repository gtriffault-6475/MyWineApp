"use client";

import { useState } from "react";
import type { CellarEntry } from "@/lib/cellar/entry";
import { CellarCard } from "./cellar-card";

function matches(entry: CellarEntry, q: string): boolean {
  return [entry.name, entry.producer, entry.appellation, entry.storage_location].some((field) =>
    field?.toLowerCase().includes(q),
  );
}

/** Bouteilles d'une cave avec la recherche « Rechercher dans la cave… » (iOS). */
export function BottleList({ entries }: { entries: CellarEntry[] }) {
  const [search, setSearch] = useState("");
  const q = search.trim().toLowerCase();
  const filtered = q ? entries.filter((e) => matches(e, q)) : entries;

  return (
    <>
      <div className="sticky top-[calc(44px+env(safe-area-inset-top))] z-10 border-b border-border bg-bg px-4 py-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher dans la cave…"
          aria-label="Rechercher dans la cave"
          className="min-h-10 w-full rounded-lg bg-surface px-3 py-2.5 text-sm text-text outline-none placeholder:text-text-light"
        />
      </div>
      {filtered.length === 0 ? (
        <p className="pt-12 text-center text-base text-text-muted">Aucun résultat pour « {search} »</p>
      ) : (
        <ul className="mx-auto w-full max-w-xl py-3 pb-20">
          {filtered.map((entry) => (
            <li key={entry.id}>
              <CellarCard entry={entry} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
