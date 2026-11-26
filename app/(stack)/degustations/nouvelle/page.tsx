import type { Metadata } from "next";
import { getEntry } from "@/lib/db/cellar";
import { isUuid } from "@/lib/validation/uuid";
import type { WineFormValues } from "@/lib/wines/input";
import { PageHeader } from "@/app/components/page-header";
import { NewWineForm } from "./new-wine-form";

export const metadata: Metadata = { title: "Ajouter une dégustation · MyVine" };

/**
 * Ajout d'une dégustation (AddScreen.tsx iOS). Depuis « Ouvrir une bouteille »
 * (?bouteille=…), le formulaire est pré-rempli et lié à la bouteille.
 */
export default async function NewWinePage({
  searchParams,
}: {
  searchParams: Promise<{ bouteille?: string }>;
}) {
  const { bouteille } = await searchParams;
  const entry = bouteille && isUuid(bouteille) ? await getEntry(bouteille) : null;

  const initial: Partial<WineFormValues> | undefined = entry
    ? {
        name: entry.name,
        producer: entry.producer ?? "",
        appellation: entry.appellation ?? "",
        // Un millésime de cave non numérique (« NV ») n'est pas repris.
        vintage: entry.vintage && /^\d{4}$/.test(entry.vintage) ? entry.vintage : "",
        cellar_entry_id: entry.id,
      }
    : undefined;

  return (
    <div className="min-h-dvh">
      <PageHeader title="Ajouter une dégustation" />
      <NewWineForm initial={initial} cancelHref={entry ? `/bouteilles/${entry.id}` : "/degustations"} />
    </div>
  );
}
