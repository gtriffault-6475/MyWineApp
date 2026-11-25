import { redirect } from "next/navigation";

// L'app iOS s'ouvre sur l'onglet Cave ; tant que cet écran n'est pas
// reconstruit, on ouvre sur les Dégustations.
export default function Home() {
  redirect("/degustations");
}
