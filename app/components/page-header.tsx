import Link from "next/link";
import { Icon } from "./icons";

/**
 * En-tête façon barre de navigation iOS : titre centré, retour à gauche,
 * actions à droite.
 */
export function PageHeader({
  title,
  back,
  actions,
}: {
  title: string;
  back?: { href: string; label: string };
  actions?: React.ReactNode;
}) {
  return (
    <header className="safe-top sticky top-0 z-10 bg-bg">
      <div className="mx-auto grid h-11 max-w-xl grid-cols-[1fr_auto_1fr] items-center gap-2 px-3">
        <div className="min-w-0">
          {back && (
            <Link
              href={back.href}
              className="-ml-1 flex items-center text-[17px] text-primary"
            >
              <Icon name="chevron-back" size={26} />
              <span className="truncate">{back.label}</span>
            </Link>
          )}
        </div>
        <h1 className="max-w-[55vw] truncate text-center text-lg font-semibold text-text">
          {title}
        </h1>
        <div className="flex min-w-0 justify-end gap-4">{actions}</div>
      </div>
    </header>
  );
}
