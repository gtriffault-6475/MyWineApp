"use client";

import { useState } from "react";
import type { ExportData } from "@/lib/export/archive";
import { photoUrl } from "@/lib/wines/wine";
import { errorMessage, readError } from "@/lib/photos/upload";

const PARALLEL_DOWNLOADS = 4;

async function downloadPhotos(
  paths: string[],
  onProgress: (done: number) => void,
): Promise<Map<string, Uint8Array>> {
  const photos = new Map<string, Uint8Array>();
  let next = 0;
  let done = 0;
  async function worker() {
    while (next < paths.length) {
      const path = paths[next++];
      try {
        const res = await fetch(photoUrl(path)!);
        if (res.ok) photos.set(path, new Uint8Array(await res.arrayBuffer()));
      } catch {
        // photo manquante : signalée dans l'archive, la sauvegarde continue
      }
      onProgress(++done);
    }
  }
  await Promise.all(Array.from({ length: PARALLEL_DOWNLOADS }, worker));
  return photos;
}

/** Remet le fichier à l'utilisateur : feuille de partage sur iPhone, sinon téléchargement. */
async function deliver(file: File): Promise<"shared" | "downloaded" | "cancelled"> {
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "Sauvegarde MyVine" });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
      // partage refusé par le navigateur : on bascule sur le téléchargement
    }
  }
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return "downloaded";
}

/**
 * « Exporter mes données » : archive ZIP (JSON + photos) assemblée sur le
 * téléphone, à garder dans Fichiers / iCloud Drive.
 */
export function ExportButton() {
  const [status, setStatus] = useState<string | null>(null);
  const [result, setResult] = useState<{ text: string; warning?: string } | null>(null);
  const busy = status !== null;

  async function handleExport() {
    setResult(null);
    setStatus("Préparation des données…");
    try {
      const res = await fetch("/api/export", { cache: "no-store" });
      if (!res.ok) throw new Error(await readError(res, "Export impossible."));
      const data = (await res.json()) as ExportData;

      setStatus(`Photos 0/${data.photos.length}…`);
      const photos = await downloadPhotos(data.photos, (done) =>
        setStatus(`Photos ${done}/${data.photos.length}…`),
      );

      setStatus("Création de l'archive…");
      const { buildArchive, archiveFileName } = await import("@/lib/export/archive");
      const { zip, missing } = buildArchive(data, photos);
      const file = new File([zip as BlobPart], archiveFileName(), { type: "application/zip" });

      const outcome = await deliver(file);
      if (outcome !== "cancelled") {
        const { caves, cellar_entries, wines } = data.counts;
        setResult({
          text: `Sauvegarde prête : ${caves} cave(s), ${cellar_entries} bouteille(s), ${wines} dégustation(s), ${photos.size} photo(s).`,
          warning:
            missing.length > 0
              ? `${missing.length} photo(s) n'ont pas pu être récupérées (listées dans l'archive).`
              : undefined,
        });
      }
    } catch (error) {
      setResult({ text: "", warning: errorMessage(error) });
    } finally {
      setStatus(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleExport}
        disabled={busy}
        className="h-12 rounded-lg bg-primary text-base font-semibold text-white disabled:opacity-60"
      >
        {status ?? "Exporter mes données"}
      </button>
      {result?.text && (
        <p role="status" className="text-sm text-success">
          {result.text}
        </p>
      )}
      {result?.warning && (
        <p role="alert" className="text-sm text-error">
          {result.warning}
        </p>
      )}
    </div>
  );
}
