"use client";

import { LOCATION_LABELS, type LocationType } from "@/lib/wines/wine";

const OPTIONS = Object.entries(LOCATION_LABELS) as [LocationType, string][];

/** Sélecteur segmenté Maison / Amis / Restaurant (LocationPicker.tsx iOS). */
export function LocationPicker({
  value,
  onChange,
}: {
  value: LocationType;
  onChange: (value: LocationType) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Lieu"
      className="flex overflow-hidden rounded-lg border border-border bg-surface"
    >
      {OPTIONS.map(([option, label]) => {
        const active = option === value;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option)}
            className={`flex-1 py-3 text-center text-xs ${
              active ? "bg-primary font-semibold text-white" : "font-medium text-text-muted"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
