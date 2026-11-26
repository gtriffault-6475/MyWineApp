"use client";

import { useState } from "react";
import { APPEARANCE_OPTIONS, THEME_COOKIE, type Appearance } from "@/lib/theme";

/** Applique le thème tout de suite et le mémorise pour le rendu serveur. */
function applyAppearance(value: Appearance) {
  const root = document.documentElement;
  if (value === "auto") {
    delete root.dataset.theme;
    document.cookie = `${THEME_COOKIE}=; path=/; max-age=0; samesite=lax`;
  } else {
    root.dataset.theme = value;
    document.cookie = `${THEME_COOKIE}=${value}; path=/; max-age=31536000; samesite=lax`;
  }
}

/** Choix Auto / Clair / Sombre, appliqué immédiatement et mémorisé (cookie, 1 an). */
export function AppearancePicker({ initial }: { initial: Appearance }) {
  const [appearance, setAppearance] = useState(initial);

  function choose(value: Appearance) {
    setAppearance(value);
    applyAppearance(value);
  }

  return (
    <div role="radiogroup" aria-label="Apparence" className="flex overflow-hidden rounded-lg border border-border bg-surface-alt">
      {APPEARANCE_OPTIONS.map((opt) => {
        const active = opt.value === appearance;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => choose(opt.value)}
            className={`flex-1 rounded-lg py-2 text-sm ${
              active ? "bg-primary font-semibold text-white" : "font-medium text-text-muted"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
