import { PageHeader } from "./page-header";
import { EmptyState } from "./empty-state";

/** Onglet dont l'écran n'est pas encore reconstruit depuis l'app iOS. */
export function ComingSoon({ title, icon }: { title: string; icon: string }) {
  return (
    <>
      <PageHeader title={title} />
      <EmptyState
        icon={icon}
        title="Bientôt disponible"
        message="Cet écran est en cours de reconstruction à partir de l'app iPhone."
      />
    </>
  );
}
