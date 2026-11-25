/**
 * Compression côté téléphone avant envoi (≈2000 px, JPEG 0,8), comme Euskara :
 * les requêtes Vercel sont limitées à 4,5 Mo et une photo d'iPhone les dépasse.
 * Le serveur renormalise de toute façon la photo.
 */
const MAX_SIDE = 2000;
const JPEG_QUALITY = 0.8;
export const MAX_UPLOAD_BYTES = 4_500_000;

export async function compressPhoto(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    try {
      const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("canvas indisponible");
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      return await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error("compression échouée"))),
          "image/jpeg",
          JPEG_QUALITY,
        ),
      );
    } finally {
      bitmap.close();
    }
  } catch {
    // Format que le navigateur ne sait pas décoder : on envoie l'original s'il
    // passe la limite, le serveur saura peut-être le lire (HEIC…).
    if (file.size <= MAX_UPLOAD_BYTES) return file;
    throw new Error("Photo trop lourde ou format non pris en charge.");
  }
}
