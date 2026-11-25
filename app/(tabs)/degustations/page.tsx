import type { Metadata } from "next";
import { listWines } from "@/lib/db/wines";
import { PageHeader } from "@/app/components/page-header";
import { EmptyState } from "@/app/components/empty-state";
import { WineCard } from "@/app/components/wine-card";

export const metadata: Metadata = { title: "Dégustations · MyVine" };

/** Liste des dégustations (reprise de DegustationsScreen.tsx iOS). */
export default async function DegustationsPage() {
  const wines = await listWines();

  return (
    <>
      <PageHeader title="Dégustations" />
      {wines.length === 0 ? (
        <EmptyState
          title="Aucune dégustation"
          message="Commencez par enregistrer votre premier vin dégusté."
        />
      ) : (
        <ul className="mx-auto w-full max-w-xl py-3 pb-20">
          {wines.map((wine) => (
            <li key={wine.id}>
              <WineCard wine={wine} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
