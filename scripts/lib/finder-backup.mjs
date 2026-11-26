/**
 * Lecture d'une sauvegarde locale de l'iPhone faite avec le Finder (ou iTunes).
 *
 * LIMITE : l'app iOS exclut sa base SQLite des sauvegardes (dossier
 * Library/LocalDatabase marqué NSURLIsExcludedFromBackupKey par
 * react-native-sqlite-storage). En pratique une sauvegarde Finder ne contient
 * que les photos : la base doit venir du conteneur Xcode (.xcappdata).
 *
 * Format (iOS 10 et suivants) : un dossier par appareil contenant
 *   - Manifest.db : index SQLite (table Files : fileID, domain, relativePath, flags)
 *   - <2 premiers caractères du fileID>/<fileID> : le contenu de chaque fichier
 * Les données d'une app sont dans le domaine « AppDomain-<bundle id> ».
 *
 * Les fichiers de MyVine sont recopiés dans un dossier temporaire avec leur
 * arborescence d'origine (AppData/Library/LocalDatabase/myvine.db,
 * AppData/Documents/wine-photos/…), puis l'import habituel prend le relais.
 * La sauvegarde n'est jamais modifiée.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const MYVINE_BUNDLE_ID = "com.myvineapp";

export class FinderBackupError extends Error {}

/** Vrai si `dir` est le dossier d'une sauvegarde d'appareil (contient Manifest.db). */
export function isFinderBackup(dir) {
  return fs.existsSync(path.join(dir, "Manifest.db"));
}

/** Sous-dossiers de `dir` qui sont des sauvegardes d'appareil (dossier Backup/). */
export function listDeviceBackups(dir) {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && isFinderBackup(path.join(dir, e.name)))
    .map((e) => path.join(dir, e.name));
}

/** Détecte (dans le cas d'un Manifest.plist XML) une sauvegarde chiffrée. */
function looksEncrypted(backupDir) {
  const plist = path.join(backupDir, "Manifest.plist");
  if (!fs.existsSync(plist)) return false;
  const text = fs.readFileSync(plist, "latin1");
  return /<key>IsEncrypted<\/key>\s*<true\s*\/>/.test(text);
}

const ENCRYPTED_MESSAGE =
  "Cette sauvegarde est chiffrée et ne peut pas être lue. Dans le Finder, " +
  "décochez « Chiffrer la sauvegarde locale » puis refaites une sauvegarde.";

async function openManifest(backupDir) {
  if (looksEncrypted(backupDir)) throw new FinderBackupError(ENCRYPTED_MESSAGE);
  const { default: Database } = await import("better-sqlite3");
  // Copie de l'index : la sauvegarde d'origine n'est jamais ouverte en écriture.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "myvine-manifest-"));
  const copy = path.join(tmp, "Manifest.db");
  fs.copyFileSync(path.join(backupDir, "Manifest.db"), copy);
  try {
    const db = new Database(copy, { readonly: true });
    db.prepare("SELECT count(*) FROM Files").get(); // échoue si chiffré / illisible
    return {
      db,
      close() {
        db.close();
        fs.rmSync(tmp, { recursive: true, force: true });
      },
    };
  } catch (error) {
    fs.rmSync(tmp, { recursive: true, force: true });
    if (/not a database|file is encrypted/i.test(String(error?.message))) {
      throw new FinderBackupError(ENCRYPTED_MESSAGE);
    }
    throw new FinderBackupError(`Index de sauvegarde illisible : ${error.message}`);
  }
}

/** Fichiers de MyVine dans la sauvegarde : base (+ -wal/-shm) et photos. */
function listAppFiles(db, bundleId) {
  return db
    .prepare(
      `SELECT fileID, relativePath FROM Files
       WHERE domain = ? AND flags = 1
         AND (relativePath LIKE '%myvine.db' OR relativePath LIKE '%myvine.db-wal'
              OR relativePath LIKE '%myvine.db-shm' OR relativePath LIKE 'Documents/wine-photos/%')`,
    )
    .all(`AppDomain-${bundleId}`);
}

/**
 * Choisit la sauvegarde à lire : `source` peut être le dossier d'un appareil
 * ou le dossier Backup/ qui en contient plusieurs (on garde alors la plus
 * récente qui contient MyVine).
 */
export async function resolveDeviceBackup(source, bundleId = MYVINE_BUNDLE_ID) {
  if (isFinderBackup(source)) return source;
  const candidates = listDeviceBackups(source);
  const withApp = [];
  for (const dir of candidates) {
    try {
      const manifest = await openManifest(dir);
      try {
        if (listAppFiles(manifest.db, bundleId).length > 0) withApp.push(dir);
      } finally {
        manifest.close();
      }
    } catch {
      // sauvegarde chiffrée ou illisible : ignorée dans la recherche
    }
  }
  if (withApp.length === 0) {
    throw new FinderBackupError(
      candidates.length > 0
        ? "Aucune sauvegarde lisible de ce dossier ne contient MyVine (sauvegardes chiffrées ?)."
        : `Aucune sauvegarde d'iPhone trouvée dans ${source}`,
    );
  }
  const mtime = (dir) => fs.statSync(path.join(dir, "Manifest.db")).mtimeMs;
  return withApp.sort((a, b) => mtime(b) - mtime(a))[0];
}

/**
 * Extrait les fichiers de MyVine d'une sauvegarde Finder vers un dossier
 * temporaire. Retourne ce dossier (à supprimer après usage via `cleanup`),
 * la sauvegarde lue et les fichiers indexés mais absents sur disque.
 */
export async function extractFromFinderBackup(source, bundleId = MYVINE_BUNDLE_ID) {
  const backupDir = await resolveDeviceBackup(source, bundleId);
  const manifest = await openManifest(backupDir);
  let files;
  try {
    files = listAppFiles(manifest.db, bundleId);
  } finally {
    manifest.close();
  }
  if (!files.some((f) => /(^|\/)myvine\.db$/.test(f.relativePath))) {
    // react-native-sqlite-storage (location « default ») range la base dans
    // Library/LocalDatabase et marque ce dossier « exclu des sauvegardes » :
    // une sauvegarde Finder ou iCloud ne contient donc jamais la base.
    throw new FinderBackupError(
      files.length > 0
        ? "Cette sauvegarde contient les photos de MyVine mais pas sa base : l'app iOS " +
            "exclut sa base des sauvegardes iPhone (Finder et iCloud). Utilisez Xcode → " +
            "Window → Devices and Simulators → MyVine → Download Container…, puis " +
            "relancez l'import sur le fichier .xcappdata obtenu."
        : `MyVine (domaine AppDomain-${bundleId}) est absente de cette sauvegarde. ` +
            "L'app est-elle bien installée sur cet iPhone, et la sauvegarde terminée ?",
    );
  }

  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "myvine-finder-"));
  const missing = [];
  for (const { fileID, relativePath } of files) {
    const stored = path.join(backupDir, fileID.slice(0, 2), fileID);
    if (!fs.existsSync(stored)) {
      missing.push(relativePath);
      continue;
    }
    // relativePath vient de l'index : on refuse tout chemin qui sortirait du dossier.
    const target = path.resolve(outDir, "AppData", relativePath);
    if (!target.startsWith(path.join(outDir, "AppData") + path.sep)) continue;
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(stored, target);
  }

  return {
    backupDir,
    dir: outDir,
    missing,
    cleanup: () => fs.rmSync(outDir, { recursive: true, force: true }),
  };
}
