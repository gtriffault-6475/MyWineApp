"use client";

import { useState } from "react";

/**
 * Photo d'étiquette servie par /api/photos. Si elle manque ou ne charge pas,
 * affiche le même verre 🍷 que l'app iOS plutôt qu'une image cassée.
 */
export function WinePhoto({
  src,
  alt,
  className,
  emojiSize,
  eager = false,
}: {
  src: string | null;
  alt: string;
  className?: string;
  emojiSize: number;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`flex items-center justify-center bg-surface-alt ${className ?? ""}`}
        role="img"
        aria-label="Pas de photo"
      >
        <span style={{ fontSize: emojiSize }} aria-hidden="true">
          🍷
        </span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- photo privée servie par notre route (déjà redimensionnée), next/image n'apporte rien ici
    <img
      src={src}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      onError={() => setFailed(true)}
      // Une image en erreur avant l'hydratation ne déclenche plus onError :
      // on vérifie son état au montage.
      ref={(img) => {
        if (img?.complete && img.naturalWidth === 0) setFailed(true);
      }}
      className={`object-cover ${className ?? ""}`}
    />
  );
}
