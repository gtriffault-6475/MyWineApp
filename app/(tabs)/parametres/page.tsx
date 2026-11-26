import type { Metadata } from "next";
import { cookies } from "next/headers";
import { parseAppearance, THEME_COOKIE } from "@/lib/theme";
import { LABEL_MODEL } from "@/lib/clients/label-recognition";
import { PageHeader } from "@/app/components/page-header";
import { AppearancePicker } from "@/app/components/settings/appearance-picker";
import { LogoutButton } from "@/app/components/settings/logout-button";
import { ExportButton } from "@/app/components/settings/export-button";

export const metadata: Metadata = { title: "Paramètres · MyVine" };

/**
 * Paramètres (SettingsScreen.tsx iOS). Les clés API ne se saisissent plus ici :
 * elles sont des variables d'environnement du serveur (Vercel), on affiche
 * seulement si elles sont configurées — jamais leur valeur.
 */
export default async function SettingsPage() {
  const appearance = parseAppearance((await cookies()).get(THEME_COOKIE)?.value);
  const hasAnthropic = Boolean(process.env.ANTHROPIC_API_KEY);
  const hasFoursquare = Boolean(process.env.FOURSQUARE_API_KEY);

  return (
    <>
      <PageHeader title="Paramètres" />
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4 p-4 pb-12">
        <Section title="Apparence">
          <AppearancePicker initial={appearance} />
        </Section>

        <Section title="Sauvegarde">
          <p className="text-sm leading-5 text-text-muted">
            Téléchargez toutes vos données (caves, bouteilles, dégustations et photos) dans une
            archive ZIP, à garder dans Fichiers ou sur iCloud Drive.
          </p>
          <ExportButton />
        </Section>

        <Section title="Reconnaissance d'étiquette IA">
          <p className="text-sm leading-5 text-text-muted">
            Prenez en photo une étiquette de vin et laissez l&apos;IA (Claude d&apos;Anthropic) remplir
            automatiquement le nom, le producteur, l&apos;appellation et le millésime.
          </p>
          <KeyStatus configured={hasAnthropic} variable="ANTHROPIC_API_KEY" />
          <p className="text-xs text-text-muted italic">Modèle utilisé : {LABEL_MODEL}.</p>
        </Section>

        <Section title="Autocomplete restaurant">
          <p className="text-sm leading-5 text-text-muted">
            Lors d&apos;une dégustation en restaurant, obtenez des suggestions de noms en temps réel grâce
            à l&apos;API Foursquare Places.
          </p>
          <KeyStatus configured={hasFoursquare} variable="FOURSQUARE_API_KEY" />
        </Section>

        <Section title="Clés API">
          <p className="text-sm leading-5 text-text-muted">
            Les clés sont conservées sur le serveur et ne transitent jamais par le téléphone. Pour les
            ajouter ou les changer : Vercel → projet → Settings → Environment Variables, puis
            redéployer.
          </p>
        </Section>

        <Section title="Session">
          <LogoutButton />
        </Section>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl bg-surface p-4">
      <h2 className="text-base font-semibold text-text">{title}</h2>
      {children}
    </section>
  );
}

function KeyStatus({ configured, variable }: { configured: boolean; variable: string }) {
  return configured ? (
    <p className="flex items-center gap-2 text-sm font-medium text-success">
      <span className="h-2 w-2 rounded-full bg-success" aria-hidden="true" />
      Clé API configurée
    </p>
  ) : (
    <p className="flex items-center gap-2 text-sm font-medium text-error">
      <span className="h-2 w-2 rounded-full bg-error" aria-hidden="true" />
      Clé absente : ajoutez {variable} dans Vercel
    </p>
  );
}
