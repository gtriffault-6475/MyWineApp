"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** « Supprimer » avec confirmation, comme l'alerte de l'app iOS. */
export function DeleteWineButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleDelete() {
    if (!window.confirm(`Supprimer « ${name} » définitivement ?`)) return;
    setPending(true);
    try {
      const res = await fetch(`/api/wines/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 404) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Suppression impossible.");
      }
      router.replace("/degustations");
      router.refresh();
    } catch (error) {
      window.alert(
        error instanceof Error && error.message !== "Failed to fetch"
          ? error.message
          : "Pas de connexion. Vérifiez le réseau et réessayez.",
      );
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={pending}
      className="text-base font-medium text-error disabled:opacity-50"
    >
      {pending ? "Suppression…" : "Supprimer"}
    </button>
  );
}
