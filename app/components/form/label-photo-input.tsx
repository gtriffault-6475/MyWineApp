"use client";

import { useRef } from "react";

/**
 * Zone photo de l'étiquette (LabelPhoto.tsx iOS). Le champ fichier n'a PAS
 * d'attribut `capture` : sur iPhone, le menu propose alors « Photothèque »,
 * « Prendre une photo » et « Choisir un fichier ».
 */
export function LabelPhotoInput({
  src,
  busyLabel,
  onPick,
  onRemove,
}: {
  src: string | null;
  busyLabel: string | null;
  onPick: (file: File) => void;
  onRemove: (() => void) | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = ""; // permet de re-choisir la même photo
          if (file) onPick(file);
        }}
      />
      <button
        type="button"
        disabled={busyLabel !== null}
        onClick={() => inputRef.current?.click()}
        aria-label={src ? "Changer la photo de l'étiquette" : "Ajouter une photo de l'étiquette"}
        className={`relative flex h-[220px] w-full flex-col items-center justify-center gap-1 overflow-hidden rounded-xl bg-surface ${
          src ? "" : "border-[1.5px] border-dashed border-border"
        }`}
      >
        {src ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- aperçu local (blob:) ou photo privée */}
            <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" />
            {!busyLabel && (
              <span className="absolute right-3 bottom-3 rounded-3xl bg-black/55 px-3 py-1 text-xs font-semibold text-white">
                Modifier
              </span>
            )}
          </>
        ) : (
          <>
            <span className="text-4xl" aria-hidden="true">
              📷
            </span>
            <span className="text-sm font-medium text-text-muted">Ajouter une photo</span>
            <span className="text-xs text-text-light">de l&apos;étiquette</span>
          </>
        )}
        {busyLabel && (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/45 text-sm font-medium text-white">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
            {busyLabel}
          </span>
        )}
      </button>
      {src && onRemove && !busyLabel && (
        <button type="button" onClick={onRemove} className="mt-2 text-sm font-medium text-error">
          Supprimer la photo
        </button>
      )}
    </div>
  );
}
