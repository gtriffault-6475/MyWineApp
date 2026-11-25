import Link from "next/link";

export default function NotFound() {
  return (
    <main className="safe-top flex min-h-dvh flex-col items-center justify-center gap-3 p-8 text-center">
      <span className="text-[56px]" aria-hidden="true">
        🍷
      </span>
      <h1 className="text-[22px] font-bold text-text">Introuvable</h1>
      <p className="text-base leading-6 text-text-muted">
        Cette fiche n&apos;existe pas ou a été supprimée.
      </p>
      <Link
        href="/degustations"
        className="mt-4 rounded-lg bg-primary px-8 py-3 font-semibold text-white"
      >
        Retour aux dégustations
      </Link>
    </main>
  );
}
