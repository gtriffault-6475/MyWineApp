"use client";

import { useEffect } from "react";

/** Erreur inattendue (réseau, base indisponible…) : message clair + réessai. */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="safe-top flex min-h-dvh flex-col items-center justify-center gap-3 p-8 text-center">
      <span className="text-[56px]" aria-hidden="true">
        🍷
      </span>
      <h1 className="text-[22px] font-bold text-text">Oups, un souci de connexion</h1>
      <p className="text-base leading-6 text-text-muted">
        Impossible de charger vos données pour le moment.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 rounded-lg bg-primary px-8 py-3 font-semibold text-white"
      >
        Réessayer
      </button>
    </main>
  );
}
