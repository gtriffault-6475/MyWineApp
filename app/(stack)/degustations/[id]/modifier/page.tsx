import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getWineById } from "@/lib/db/wines";
import { wineToForm } from "@/lib/wines/input";
import { isUuid } from "@/lib/validation/uuid";
import { PageHeader } from "@/app/components/page-header";
import { WineForm } from "@/app/components/form/wine-form";

export const metadata: Metadata = { title: "Modifier · MyVine" };

/** Modification d'une dégustation (WineEditScreen.tsx iOS). */
export default async function EditWinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const wine = await getWineById(id);
  if (!wine) notFound();

  return (
    <div className="min-h-dvh">
      <PageHeader title="Modifier" back={{ href: `/degustations/${wine.id}`, label: "Retour" }} />
      <WineForm
        mode="edit"
        wineId={wine.id}
        initial={wineToForm(wine)}
        cancelHref={`/degustations/${wine.id}`}
      />
    </div>
  );
}
