import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCave } from "@/lib/db/caves";
import { listEntriesForCave } from "@/lib/db/cellar";
import { isUuid } from "@/lib/validation/uuid";
import { PageHeader } from "@/app/components/page-header";
import { EmptyState } from "@/app/components/empty-state";
import { Fab } from "@/app/components/fab";
import { CaveMenu } from "@/app/components/cellar/cave-actions";
import { BottleList } from "@/app/components/cellar/bottle-list";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const cave = isUuid(id) ? await getCave(id) : null;
  return { title: cave ? `${cave.name} · MyVine` : "MyVine" };
}

/** Bouteilles d'une cave (CellarBottlesScreen.tsx iOS). */
export default async function CavePage({ params }: Props) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [cave, entries] = await Promise.all([getCave(id), listEntriesForCave(id)]);
  if (!cave) notFound();
  const addHref = `/bouteilles/nouvelle?cave=${cave.id}`;

  return (
    <div className="min-h-dvh">
      <PageHeader
        title={cave.name}
        back={{ href: "/caves", label: "Mes caves" }}
        actions={<CaveMenu cave={cave} afterDelete="/caves" />}
      />
      {entries.length === 0 ? (
        <div className="flex min-h-[70dvh] flex-col">
          <EmptyState icon="🍾" title="Cave vide" message="Ajoutez vos premières bouteilles à cette cave.">
            <Link href={addHref} className="mt-4 rounded-lg bg-primary px-8 py-3 text-base font-semibold text-white">
              Ajouter une bouteille
            </Link>
          </EmptyState>
        </div>
      ) : (
        <BottleList entries={entries} />
      )}
      <Fab href={addHref} label="Ajouter une bouteille" aboveTabs={false} />
    </div>
  );
}
