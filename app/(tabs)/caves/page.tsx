import type { Metadata } from "next";
import Link from "next/link";
import { listCaves } from "@/lib/db/caves";
import { bottlesLabel, MAX_CAVES } from "@/lib/cellar/entry";
import { PageHeader } from "@/app/components/page-header";
import { EmptyState } from "@/app/components/empty-state";
import { Fab } from "@/app/components/fab";
import { Icon } from "@/app/components/icons";
import { AddCaveButton, CaveMenu } from "@/app/components/cellar/cave-actions";

export const metadata: Metadata = { title: "Mes caves · MyVine" };

/** Liste des caves (CaveListScreen.tsx iOS). */
export default async function CavesPage() {
  const caves = await listCaves();
  const canAddCave = caves.length < MAX_CAVES;

  return (
    <>
      <PageHeader title="Mes caves" actions={canAddCave ? <AddCaveButton /> : undefined} />

      {caves.length === 0 ? (
        <EmptyState
          icon="🍾"
          title="Aucune cave"
          message="Créez votre première cave pour commencer à gérer vos bouteilles."
        >
          {canAddCave && <AddCaveButton label="Créer une cave" />}
        </EmptyState>
      ) : (
        <ul className="mx-auto flex w-full max-w-xl flex-col gap-2 px-4 pt-3 pb-20">
          {caves.map((cave) => (
            <li
              key={cave.id}
              className="flex items-center gap-1 rounded-xl border border-border bg-surface pr-2"
            >
              <Link
                href={`/caves/${cave.id}`}
                className="flex min-w-0 flex-1 items-center gap-3 py-4 pl-4 active:opacity-75"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center text-[28px]" aria-hidden="true">
                  🍷
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate text-lg font-semibold text-text">{cave.name}</span>
                  <span className="text-sm text-text-muted">{bottlesLabel(cave.bottle_count)}</span>
                </span>
                <Icon name="chevron-forward" size={20} className="shrink-0 text-text-light" />
              </Link>
              <CaveMenu cave={cave} />
            </li>
          ))}
        </ul>
      )}

      <Fab href="/bouteilles/nouvelle" label="Ajouter une bouteille" />
    </>
  );
}
