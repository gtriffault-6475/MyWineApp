import type { Metadata } from "next";
import { PageHeader } from "@/app/components/page-header";
import { NewWineForm } from "./new-wine-form";

export const metadata: Metadata = { title: "Ajouter une dégustation · MyVine" };

/** Ajout d'une dégustation (AddScreen.tsx iOS). */
export default function NewWinePage() {
  return (
    <div className="min-h-dvh">
      <PageHeader title="Ajouter une dégustation" />
      <NewWineForm />
    </div>
  );
}
