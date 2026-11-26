import { NextResponse } from "next/server";
import { exportAll } from "@/lib/db/export";
import { EXPORT_FORMAT, EXPORT_VERSION, referencedPhotos, type ExportData } from "@/lib/export/archive";

/**
 * Données de la sauvegarde (JSON). Les photos ne sont pas incluses ici : le
 * téléphone les télécharge une par une via /api/photos et assemble le ZIP
 * (une réponse de fonction Vercel est limitée à ~4,5 Mo).
 */
export async function GET() {
  try {
    const { caves, cellar_entries, wines } = await exportAll();
    const photos = referencedPhotos([...cellar_entries, ...wines]);
    const data: ExportData = {
      format: EXPORT_FORMAT,
      version: EXPORT_VERSION,
      exported_at: new Date().toISOString(),
      counts: {
        caves: caves.length,
        cellar_entries: cellar_entries.length,
        wines: wines.length,
        photos: photos.length,
      },
      caves,
      cellar_entries,
      wines,
      photos,
    };
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Échec de l'export :", error);
    return NextResponse.json(
      { error: "Export impossible pour le moment. Réessayez." },
      { status: 503 },
    );
  }
}
