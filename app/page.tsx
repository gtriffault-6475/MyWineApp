import { redirect } from "next/navigation";

// Comme l'app iOS, MyVine s'ouvre sur l'onglet Cave.
export default function Home() {
  redirect("/caves");
}
