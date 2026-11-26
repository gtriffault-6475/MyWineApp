import type { Metadata } from "next";
import { listCaves } from "@/lib/db/caves";
import { emptyCellarForm } from "@/lib/cellar/entry";
import { isUuid } from "@/lib/validation/uuid";
import { PageHeader } from "@/app/components/page-header";
import { CellarForm } from "@/app/components/cellar/cellar-form";

export const metadata: Metadata = { title: "Ajouter à la cave · MyVine" };

/** Ajout d'une bouteille (AddCellarEntryScreen iOS), depuis Mes caves ou une cave. */
export default async function NewBottlePage({
  searchParams,
}: {
  searchParams: Promise<{ cave?: string }>;
}) {
  const { cave } = await searchParams;
  const caves = await listCaves();
  const fromCave = cave && isUuid(cave) ? caves.find((c) => c.id === cave) : undefined;
  // Cave par défaut : celle d'où l'on vient, sinon la première (comme iOS).
  const caveId = fromCave?.id ?? caves[0]?.id ?? null;

  return (
    <div className="min-h-dvh">
      <PageHeader title="Ajouter à la cave" />
      <CellarForm
        caves={caves}
        initial={emptyCellarForm(caveId)}
        doneHref={fromCave ? `/caves/${fromCave.id}` : "/caves"}
      />
    </div>
  );
}
