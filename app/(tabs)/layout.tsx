import { TabBar } from "@/app/components/tab-bar";

/** Écrans à onglets : contenu + barre d'onglets fixe en bas (comme iOS). */
export default function TabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col pb-[calc(54px+env(safe-area-inset-bottom))]">
      {children}
      <TabBar />
    </div>
  );
}
