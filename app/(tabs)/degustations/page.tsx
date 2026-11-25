import type { Metadata } from "next";
import Link from "next/link";
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
        >
          <Link
            href="/degustations/nouvelle"
            className="mt-4 rounded-lg bg-primary px-8 py-3 text-base font-semibold text-white"
          >
            Ajouter une dégustation
          </Link>
        </EmptyState>
      ) : (
        <ul className="mx-auto w-full max-w-xl py-3 pb-20">
          {wines.map((wine) => (
            <li key={wine.id}>
              <WineCard wine={wine} />
            </li>
          ))}
        </ul>
      )}

      {/* Bouton flottant « + » au-dessus de la barre d'onglets, comme iOS */}
      <Link
        href="/degustations/nouvelle"
        aria-label="Ajouter une dégustation"
        className="fixed right-6 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-[28px] leading-none text-white active:opacity-85"
        style={{
          bottom: "calc(54px + env(safe-area-inset-bottom) + 24px)",
          boxShadow: "var(--shadow-fab)",
        }}
      >
        +
      </Link>
    </>
  );
}
