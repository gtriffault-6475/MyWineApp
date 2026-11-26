"use client";

import dynamic from "next/dynamic";
import type { WineFormValues } from "@/lib/wines/input";

// Rendu côté téléphone uniquement : la date proposée par défaut est « aujourd'hui »
// dans le fuseau de l'utilisateur, pas celui du serveur.
const WineForm = dynamic(
  () => import("@/app/components/form/wine-form").then((m) => m.WineForm),
  {
    ssr: false,
    loading: () => (
      <div className="flex justify-center p-12" aria-label="Chargement…">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    ),
  },
);

export function NewWineForm({
  initial,
  cancelHref,
}: {
  initial?: Partial<WineFormValues>;
  cancelHref: string;
}) {
  return <WineForm mode="create" initial={initial} cancelHref={cancelHref} />;
}
