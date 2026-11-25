"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./icons";

// Mêmes onglets, libellés et icônes que l'app iOS (navigation/index.tsx).
const TABS: { href: string; label: string; icon: IconName; iconActive: IconName }[] = [
  { href: "/caves", label: "Cave", icon: "albums-outline", iconActive: "albums" },
  { href: "/degustations", label: "Dégustations", icon: "wine-outline", iconActive: "wine" },
  { href: "/recherche", label: "Recherche", icon: "search-outline", iconActive: "search" },
  { href: "/stats", label: "Stats", icon: "bar-chart-outline", iconActive: "bar-chart" },
  { href: "/parametres", label: "Paramètres", icon: "settings-outline", iconActive: "settings" },
];

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-20 border-t border-border bg-bg">
      <ul className="mx-auto flex max-w-xl">
        {TABS.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className="flex flex-col items-center gap-0.5 pt-1.5 pb-1 text-[11px] font-medium"
                style={{ color: active ? "var(--tab-active)" : "var(--tab-inactive)" }}
              >
                <Icon name={active ? tab.iconActive : tab.icon} size={25} />
                <span>{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
