import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getEntry } from "@/lib/db/cellar";
import { listCaves } from "@/lib/db/caves";
import { entryToForm } from "@/lib/cellar/entry";
import { isUuid } from "@/lib/validation/uuid";
import { PageHeader } from "@/app/components/page-header";
import { CellarForm } from "@/app/components/cellar/cellar-form";

export const metadata: Metadata = { title: "Modifier la bouteille · MyVine" };

/** Modification d'une bouteille (AddCellarEntryScreen iOS en mode édition). */
export default async function EditBottlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [entry, caves] = await Promise.all([getEntry(id), listCaves()]);
  if (!entry) notFound();

  return (
    <div className="min-h-dvh">
      <PageHeader title="Modifier la bouteille" />
      <CellarForm caves={caves} initial={entryToForm(entry)} entryId={entry.id} doneHref={`/bouteilles/${entry.id}`} />
    </div>
  );
}
