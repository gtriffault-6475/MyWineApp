"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { errorMessage, readError } from "@/lib/photos/upload";

/**
 * « Ouvrir une bouteille » puis « Supprimer de la cave » (CellarDetailScreen iOS).
 * Après ouverture, propose d'enregistrer la dégustation, pré-remplie depuis la
 * bouteille — même quand c'était la dernière (corrige un bug de l'app iOS).
 */
export function BottleActions({
  id,
  name,
  quantity,
  backHref,
}: {
  id: string;
  name: string;
  quantity: number;
  backHref: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<"open" | "delete" | null>(null);

  async function handleOpen() {
    if (!window.confirm(`Ouvrir une bouteille\n\nDécompter une bouteille de « ${name} » ?`)) return;
    setPending("open");
    try {
      const res = await fetch(`/api/cellar/${id}/open`, { method: "POST" });
      if (!res.ok) throw new Error(await readError(res, "Impossible de mettre à jour la cave."));
      const record = window.confirm("Bouteille ouverte\n\nVoulez-vous enregistrer cette dégustation ?");
      if (record) {
        router.push(`/degustations/nouvelle?bouteille=${id}`);
      } else {
        router.refresh();
        setPending(null);
      }
    } catch (error) {
      window.alert(errorMessage(error));
      setPending(null);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Supprimer cette bouteille\n\nSupprimer « ${name} » de la cave définitivement ?`)) return;
    setPending("delete");
    try {
      const res = await fetch(`/api/cellar/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 404) {
        throw new Error(await readError(res, "Impossible de supprimer la bouteille."));
      }
      router.replace(backHref);
      router.refresh();
    } catch (error) {
      window.alert(errorMessage(error));
      setPending(null);
    }
  }

  return (
    <div className="mt-2 flex flex-col gap-3">
      {quantity > 0 && (
        <button
          type="button"
          onClick={handleOpen}
          disabled={pending !== null}
          className="h-12 rounded-lg bg-primary text-base font-semibold text-white disabled:opacity-60"
        >
          {pending === "open" ? "Ouverture…" : "Ouvrir une bouteille"}
        </button>
      )}
      <button
        type="button"
        onClick={handleDelete}
        disabled={pending !== null}
        className="h-12 rounded-lg bg-error text-base font-semibold text-white disabled:opacity-60"
      >
        {pending === "delete" ? "Suppression…" : "Supprimer de la cave"}
      </button>
    </div>
  );
}
