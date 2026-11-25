"use client";

// Couleurs de l'app iOS (ScorePicker.tsx).
function scoreColor(s: number): string {
  if (s <= 3) return "#D04040";
  if (s <= 5) return "#D0883A";
  if (s <= 7) return "#C9A84C";
  if (s <= 8) return "#7AB648";
  return "#4A9060";
}

/** Note de 1 à 10 en pastilles ; un second appui sur la note l'efface. */
export function ScorePicker({
  score,
  onChange,
}: {
  score: number | null;
  onChange: (score: number | null) => void;
}) {
  return (
    <div>
      <div role="radiogroup" aria-label="Note sur 10" className="grid grid-cols-10 gap-1">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((s) => {
          const active = score === s;
          return (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(active ? null : s)}
              className="mx-auto flex aspect-square w-full max-w-9 items-center justify-center rounded-full border-[1.5px] text-xs font-semibold"
              style={
                active
                  ? { backgroundColor: scoreColor(s), borderColor: scoreColor(s), color: "#fff" }
                  : {
                      backgroundColor: "var(--surface)",
                      borderColor: "var(--border)",
                      color: "var(--text-muted)",
                    }
              }
            >
              {s}
            </button>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between px-1 text-xs text-text-light">
        <span>Mauvais</span>
        <span>Excellent</span>
      </div>
    </div>
  );
}
