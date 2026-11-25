import { filledStars } from "@/lib/wines/wine";

/** Note sur 10 affichée en 5 étoiles + valeur, comme l'app iOS (lecture seule). */
export function StarRating({ score, size = 28 }: { score: number | null; size?: number }) {
  const filled = filledStars(score);
  return (
    <span
      className="inline-flex items-center gap-1"
      aria-label={score === null ? "Pas de note" : `Note : ${score} sur 10`}
    >
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          aria-hidden="true"
          style={{
            fontSize: size,
            lineHeight: 1,
            color: i < filled ? "var(--score-gold)" : "var(--border)",
          }}
        >
          {i < filled ? "★" : "☆"}
        </span>
      ))}
      {score !== null && (
        <span aria-hidden="true" className="ml-1 text-[13px] text-text-muted">
          {score.toFixed(1)}
        </span>
      )}
    </span>
  );
}
