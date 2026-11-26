#!/usr/bin/env node
/**
 * Import des données de l'app iOS MyVine vers l'app web (Neon + Vercel Blob).
 *
 * Usage :
 *   npm run import:legacy -- <chemin vers .xcappdata | dossier | myvine.db>
 *   npm run import:legacy -- <sauvegarde Finder de l'iPhone (non chiffrée)>
 *   npm run import:legacy -- <chemin> --apply
 *
 * Sources acceptées :
 *   - le conteneur téléchargé avec Xcode (Download Container… → .xcappdata) ;
 *   - une sauvegarde locale faite avec le Finder : le dossier d'un appareil, ou
 *     directement ~/Library/Application Support/MobileSync/Backup (la sauvegarde
 *     la plus récente contenant MyVine est alors choisie).
 *
 * Sans --apply : simulation, rien n'est écrit (rapport uniquement).
 * Avec --apply : upload des photos vers Blob (privé), puis insertion en base
 * dans une seule transaction, puis vérification des compteurs.
 *
 * Rejouable : les UUID sont dérivés des id iOS et les photos gardent le même
 * chemin, donc relancer l'import ne crée aucun doublon.
 */
import fs from "node:fs";
import pg from "pg";
import { put } from "@vercel/blob";
import {
  buildImportPlan,
  countImported,
  listPhotoFiles,
  locateLegacyFiles,
  readLegacyDatabase,
  writePlan,
} from "./lib/legacy-import.mjs";
import {
  extractFromFinderBackup,
  isFinderBackup,
  listDeviceBackups,
} from "./lib/finder-backup.mjs";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const source = args.find((a) => !a.startsWith("--"));

if (!source) {
  console.error(
    "Usage : npm run import:legacy -- <chemin .xcappdata | sauvegarde Finder> [--apply]",
  );
  process.exit(1);
}

function printList(title, items, max = 50) {
  if (items.length === 0) return;
  console.log(`\n${title} (${items.length}) :`);
  for (const item of items.slice(0, max)) console.log(`  - ${item}`);
  if (items.length > max) console.log(`  … et ${items.length - max} autre(s)`);
}

async function main() {
  // Sauvegarde Finder : on extrait d'abord les fichiers de MyVine dans un
  // dossier temporaire, puis l'import se déroule comme pour un .xcappdata.
  if (isFinderBackup(source) || listDeviceBackups(source).length > 0) {
    console.log("Sauvegarde Finder détectée, extraction des fichiers de MyVine…");
    const extracted = await extractFromFinderBackup(source);
    console.log(`Sauvegarde   : ${extracted.backupDir}`);
    if (extracted.missing.length > 0) {
      printList("Fichiers indexés mais absents de la sauvegarde", extracted.missing);
    }
    try {
      return await run(extracted.dir);
    } finally {
      extracted.cleanup();
    }
  }
  return run(source);
}

/** Import depuis un dossier qui contient myvine.db (et wine-photos). Retourne le code de sortie. */
async function run(root) {
  const { dbPath, photosDir } = locateLegacyFiles(root);
  console.log(`Base iOS     : ${dbPath}`);
  console.log(`Photos       : ${photosDir ?? "(aucun dossier wine-photos trouvé)"}`);

  const legacy = await readLegacyDatabase(dbPath);
  const photoFiles = listPhotoFiles(photosDir);
  const plan = buildImportPlan(legacy, photoFiles);

  console.log(`\nVersion base : ${legacy.dbVersion}`);
  console.log(`Caves        : ${plan.counts.caves}`);
  console.log(`Bouteilles   : ${plan.counts.cellarEntries}`);
  console.log(`Dégustations : ${plan.counts.wines}`);
  console.log(`Photos       : ${plan.counts.photos} référencée(s) / ${photoFiles.size} sur disque`);

  printList("Avertissements", plan.warnings);
  printList("ERREURS (bloquantes)", plan.errors);

  if (plan.errors.length > 0) {
    console.error("\nImport impossible tant que les erreurs ci-dessus ne sont pas résolues.");
    return 2;
  }

  if (!apply) {
    console.log("\nSimulation terminée — rien n'a été écrit. Relancez avec --apply pour importer.");
    return 0;
  }

  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL n'est pas défini (.env.local)");
  // Blob : OIDC (BLOB_STORE_ID + VERCEL_OIDC_TOKEN via `vercel env pull`) ou token.
  if (!process.env.BLOB_STORE_ID && !process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("Ni BLOB_STORE_ID ni BLOB_READ_WRITE_TOKEN dans .env.local (npx vercel env pull)");
  }

  // 1. Photos d'abord : si l'upload échoue, la base n'a pas été touchée.
  console.log(`\nUpload de ${plan.photos.length} photo(s) vers Vercel Blob…`);
  let done = 0;
  for (const photo of plan.photos) {
    await put(photo.blobPath, fs.readFileSync(photo.localPath), {
      access: "private",
      contentType: photo.contentType,
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    done += 1;
    if (done % 10 === 0 || done === plan.photos.length) {
      console.log(`  ${done}/${plan.photos.length}`);
    }
  }

  // 2. Base : une seule transaction.
  console.log("\nConnexion à la base…");
  const client = await connectWithRetry(process.env.DATABASE_URL);
  console.log("Insertion des données (transaction unique)…");
  try {
    const inserted = await writePlan(client, plan);
    console.log(
      `\nInsérées : ${inserted.caves} cave(s), ${inserted.cellarEntries} bouteille(s), ${inserted.wines} dégustation(s)` +
        " (0 = déjà présente lors d'un import précédent).",
    );

    // 3. Vérification : tout ce qui est dans la source doit être en base.
    const inDb = await countImported(client);
    const ok =
      inDb.caves === plan.counts.caves &&
      inDb.cellarEntries === plan.counts.cellarEntries &&
      inDb.wines === plan.counts.wines;
    console.log(
      `\nVérification : base = ${inDb.caves} / ${inDb.cellarEntries} / ${inDb.wines}, ` +
        `source = ${plan.counts.caves} / ${plan.counts.cellarEntries} / ${plan.counts.wines} → ${ok ? "OK" : "ÉCART"}`,
    );
    return ok ? 0 : 3;
  } finally {
    await client.end();
  }
}

/**
 * Connexion à Neon avec quelques nouvelles tentatives : une base Neon en veille
 * peut mettre quelques secondes à répondre au premier appel.
 */
async function connectWithRetry(connectionString, attempts = 3) {
  for (let i = 1; ; i++) {
    const client = new pg.Client({ connectionString, connectionTimeoutMillis: 15_000 });
    try {
      await client.connect();
      return client;
    } catch (error) {
      await client.end().catch(() => {});
      if (i >= attempts) throw error;
      console.log(`  tentative ${i} échouée (${describeError(error)}), nouvel essai…`);
      await new Promise((r) => setTimeout(r, 3000 * i));
    }
  }
}

/** Message lisible même pour les erreurs sans texte (ex. AggregateError réseau). */
function describeError(error) {
  if (!(error instanceof Error)) return String(error);
  const parts = [error.message || error.name];
  if (error.code) parts.push(`code ${error.code}`);
  if (Array.isArray(error.errors) && error.errors.length > 0) {
    parts.push(error.errors.map((e) => e?.message || e?.code || String(e)).join(" ; "));
  }
  return parts.filter(Boolean).join(" — ");
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    console.error(`\nÉchec : ${describeError(error)}`);
    if (process.env.DEBUG) console.error(error);
    else console.error("(Relancez avec DEBUG=1 devant la commande pour le détail complet.)");
    console.error(
      "La base n'a pas été modifiée (transaction annulée). L'import peut être relancé sans risque de doublon.",
    );
    process.exitCode = 1;
  });
