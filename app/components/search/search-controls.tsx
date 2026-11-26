"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  activeFilterCount,
  DEFAULT_FILTERS,
  filtersToParams,
  LOCATION_OPTIONS,
  SORT_OPTIONS,
  type WineSearchFilters,
} from "@/lib/wines/search";

/**
 * Barre de recherche + panneau « Filtres » (SearchScreen / SearchFilters iOS).
 * Les filtres vivent dans l'URL : le serveur recalcule les résultats, et on
 * retrouve sa recherche en revenant d'une fiche.
 */
export function SearchControls({
  initial,
  children,
}: {
  initial: WineSearchFilters;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [filters, setFilters] = useState(initial);
  const [showFilters, setShowFilters] = useState(false);
  // Incrémenté à chaque réinitialisation pour vider les champs de note.
  const [resetCount, setResetCount] = useState(0);
  const [pending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  function apply(next: WineSearchFilters, instant: boolean) {
    setFilters(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const go = () => {
      const query = filtersToParams(next).toString();
      startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
    };
    // Comme iOS : 300 ms après la frappe pour le texte, immédiat pour les filtres.
    if (instant) go();
    else debounceRef.current = setTimeout(go, 300);
  }

  const set = <K extends keyof WineSearchFilters>(key: K, value: WineSearchFilters[K]) =>
    apply({ ...filters, [key]: value }, true);

  function reset() {
    apply(DEFAULT_FILTERS, true);
    setResetCount((n) => n + 1);
    setShowFilters(false);
  }

  const count = activeFilterCount(filters);

  return (
    <>
      <div className="safe-top sticky top-0 z-10 border-b border-border bg-surface">
        <div className="mx-auto max-w-xl px-4 pt-4 pb-2">
          <h1 className="sr-only">Rechercher</h1>
          <div className="flex items-center gap-2">
            <input
              type="search"
              value={filters.term}
              onChange={(e) => apply({ ...filters, term: e.target.value }, false)}
              placeholder="Vin, producteur, appellation, plat, avec qui…"
              aria-label="Rechercher une dégustation"
              enterKeyHint="search"
              autoCorrect="off"
              className="min-h-12 min-w-0 flex-1 rounded-lg border border-border bg-surface px-4 py-3 text-base text-text outline-none placeholder:text-text-light focus:border-primary"
            />
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              aria-expanded={showFilters}
              className={`shrink-0 rounded-lg border px-3 py-2 text-xs font-semibold ${
                showFilters ? "border-primary bg-primary text-white" : "border-border bg-surface-alt text-text-muted"
              }`}
            >
              Filtres{count > 0 ? ` (${count})` : ""}
            </button>
          </div>
          {count > 0 && !showFilters && (
            <button type="button" onClick={reset} className="mt-1 w-full py-1 text-center text-xs font-medium text-primary">
              {count} filtre{count > 1 ? "s" : ""} actif{count > 1 ? "s" : ""} — Réinitialiser
            </button>
          )}
        </div>

        {showFilters && (
          <div className="mx-auto max-w-xl border-t border-border px-4 pb-3">
            <FilterLabel>Trier par</FilterLabel>
            <ChipRow options={SORT_OPTIONS} selected={filters.sortBy} onSelect={(v) => set("sortBy", v)} />

            <FilterLabel>Lieu</FilterLabel>
            <ChipRow options={LOCATION_OPTIONS} selected={filters.locationType} onSelect={(v) => set("locationType", v)} />

            <FilterLabel>Note (1–10)</FilterLabel>
            <div className="flex items-center gap-2">
              <ScoreInput key={`min-${resetCount}`} label="Note minimum" placeholder="Min" value={filters.scoreMin} onChange={(v) => set("scoreMin", v)} />
              <span className="text-text-muted">–</span>
              <ScoreInput key={`max-${resetCount}`} label="Note maximum" placeholder="Max" value={filters.scoreMax} onChange={(v) => set("scoreMax", v)} />
            </div>

            <FilterLabel>Date de dégustation</FilterLabel>
            <div className="flex items-center gap-2">
              <DateInput label="Du" value={filters.dateFrom} onChange={(v) => set("dateFrom", v)} />
              <span className="text-text-muted">–</span>
              <DateInput label="Au" value={filters.dateTo} onChange={(v) => set("dateTo", v)} />
            </div>

            <label className="mt-2 flex cursor-pointer items-center justify-between py-2">
              <span className="text-sm text-text">À racheter uniquement</span>
              <span className="relative inline-flex shrink-0">
                <input
                  type="checkbox"
                  role="switch"
                  checked={filters.buyAgainOnly}
                  onChange={(e) => set("buyAgainOnly", e.target.checked)}
                  className="peer sr-only"
                />
                <span className="h-[31px] w-[51px] rounded-full bg-border transition-colors peer-checked:bg-success" />
                <span className="pointer-events-none absolute top-0.5 left-0.5 h-[27px] w-[27px] rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
              </span>
            </label>

            {count > 0 && (
              <button
                type="button"
                onClick={reset}
                className="mt-1 w-full rounded-lg border border-error py-2 text-center text-xs font-medium text-error"
              >
                Réinitialiser tous les filtres
              </button>
            )}
          </div>
        )}
      </div>

      <div aria-busy={pending} className={`transition-opacity ${pending ? "opacity-50" : ""}`}>
        {children}
      </div>
    </>
  );
}

function FilterLabel({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 mb-1 text-xs font-semibold tracking-wide text-text-muted uppercase">{children}</p>;
}

function ChipRow<T extends string | null>({
  options,
  selected,
  onSelect,
}: {
  options: { value: T; label: string }[];
  selected: T;
  onSelect: (v: T) => void;
}) {
  return (
    <div className="-mx-4 flex gap-1 overflow-x-auto px-4 [scrollbar-width:none]">
      {options.map((opt) => {
        const active = opt.value === selected;
        return (
          <button
            key={String(opt.value)}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(opt.value)}
            className={`shrink-0 rounded-3xl border px-3 py-1 text-xs whitespace-nowrap ${
              active ? "border-primary bg-primary font-semibold text-white" : "border-border bg-surface text-text-muted"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function ScoreInput({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  // Valeur saisie gardée localement : « 1 » puis « 10 » ne doit pas être refusé en route.
  const [text, setText] = useState(value?.toString() ?? "");
  return (
    <input
      inputMode="numeric"
      aria-label={label}
      placeholder={placeholder}
      value={text}
      maxLength={2}
      onChange={(e) => {
        const t = e.target.value.replace(/\D/g, "");
        setText(t);
        const n = Number(t);
        if (t === "") onChange(null);
        else if (n >= 1 && n <= 10) onChange(n);
      }}
      className="w-16 rounded-lg border border-border bg-surface px-2 py-1 text-center text-sm text-text outline-none placeholder:text-text-muted focus:border-primary"
    />
  );
}

function DateInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  return (
    <input
      type="date"
      aria-label={`${label} (date de dégustation)`}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-2 py-1 text-sm text-text outline-none focus:border-primary"
    />
  );
}
