// Page d'accueil provisoire : les 5 onglets (Cave, Dégustations, Recherche,
// Stats, Paramètres) arrivent avec les stories de l'Epic « Parité iOS ».
export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-2 px-4">
      <h1 className="font-serif text-4xl italic text-primary">MyVine</h1>
      <p className="text-sm text-text-muted">Socle en place — écrans à venir.</p>
    </main>
  );
}
