import Link from "next/link";

/** Bouton flottant « + » au-dessus de la barre d'onglets (ou du bas d'écran). */
export function Fab({ href, label, aboveTabs = true }: { href: string; label: string; aboveTabs?: boolean }) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="fixed right-6 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-[28px] leading-none text-white active:opacity-85"
      style={{
        bottom: aboveTabs
          ? "calc(54px + env(safe-area-inset-bottom) + 24px)"
          : "calc(env(safe-area-inset-bottom) + 32px)",
        boxShadow: "var(--shadow-fab)",
      }}
    >
      +
    </Link>
  );
}
