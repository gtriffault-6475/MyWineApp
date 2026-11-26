import { compressPhoto } from "./compress";

export const NETWORK_ERROR = "Pas de connexion. Vérifiez le réseau et réessayez.";

/** Message lisible pour une erreur de fetch (réseau coupé ou message serveur). */
export function errorMessage(error: unknown): string {
  return error instanceof TypeError ? NETWORK_ERROR : (error as Error).message;
}

export async function readError(res: Response, fallback: string): Promise<string> {
  const data = await res.json().catch(() => null);
  return data?.error ?? fallback;
}

/**
 * Compresse puis envoie une photo d'étiquette. `onPreview` reçoit tout de suite
 * un aperçu local (blob:) à afficher pendant l'envoi.
 */
export async function uploadLabelPhoto(
  file: File,
  onPreview: (url: string) => void,
): Promise<string> {
  const blob = await compressPhoto(file);
  onPreview(URL.createObjectURL(blob));
  const body = new FormData();
  body.set("photo", blob, "etiquette.jpg");
  const res = await fetch("/api/photos", { method: "POST", body });
  if (!res.ok) throw new Error(await readError(res, "Envoi de la photo impossible."));
  const { photo_path } = (await res.json()) as { photo_path: string };
  return photo_path;
}
