/**
 * Logique pure de l'import des données de l'app iOS (SQLite, DB_VERSION 4)
 * vers le schéma Postgres de l'app web. Aucune E/S réseau ici : le script
 * scripts/import-legacy.mjs s'occupe de la lecture des fichiers, de l'upload
 * Blob et de l'écriture en base. Ce découpage rend la transformation testable.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const SUPPORTED_LEGACY_DB_VERSION = 4;
export const LEGACY_DB_NAME = "myvine.db";
export const PHOTOS_DIR = "wine-photos";

// Espace de noms fixe : garantit qu'un même id iOS donne toujours le même UUID,
// ce qui rend l'import rejouable sans doublon et sans table de correspondance.
const NAMESPACE = "myvine-legacy-import-v1";

/** UUID déterministe (format v5, SHA-1) dérivé de la table et de l'id iOS. */
export function legacyUuid(table, legacyId) {
  const hash = createHash("sha1")
    .update(`${NAMESPACE}:${table}:${legacyId}`)
    .digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50; // version 5
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variante RFC 4122
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// ---------------------------------------------------------------------------
// Localisation des fichiers dans un conteneur Xcode (.xcappdata) ou un dossier
// ---------------------------------------------------------------------------

function walk(dir, visit) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (visit(full, entry) === "stop") return "stop";
    if (entry.isDirectory() && walk(full, visit) === "stop") return "stop";
  }
}

/**
 * Trouve myvine.db et le dossier wine-photos sous `root`. `root` peut être le
 * .xcappdata téléchargé depuis Xcode, n'importe quel dossier qui les contient,
 * ou directement le fichier myvine.db.
 */
export function locateLegacyFiles(root) {
  const resolved = path.resolve(root);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Chemin introuvable : ${resolved}`);
  }

  let dbPath = null;
  let photosDir = null;

  if (fs.statSync(resolved).isFile()) {
    dbPath = resolved;
    const sibling = path.join(path.dirname(resolved), PHOTOS_DIR);
    if (fs.existsSync(sibling)) photosDir = sibling;
  } else {
    const dbs = [];
    const photoDirs = [];
    walk(resolved, (full, entry) => {
      if (entry.isFile() && entry.name === LEGACY_DB_NAME) dbs.push(full);
      if (entry.isDirectory() && entry.name === PHOTOS_DIR) photoDirs.push(full);
    });
    if (dbs.length > 1) {
      throw new Error(
        `Plusieurs ${LEGACY_DB_NAME} trouvés, précisez lequel :\n  ${dbs.join("\n  ")}`,
      );
    }
    if (photoDirs.length > 1) {
      throw new Error(
        `Plusieurs dossiers ${PHOTOS_DIR} trouvés :\n  ${photoDirs.join("\n  ")}`,
      );
    }
    dbPath = dbs[0] ?? null;
    photosDir = photoDirs[0] ?? null;
  }

  if (!dbPath) {
    throw new Error(`${LEGACY_DB_NAME} introuvable sous ${resolved}`);
  }
  return { dbPath, photosDir };
}

/** Liste les fichiers photo présents, en chemins relatifs "wine-photos/<nom>". */
export function listPhotoFiles(photosDir) {
  if (!photosDir) return new Map();
  const files = new Map();
  for (const entry of fs.readdirSync(photosDir, { withFileTypes: true })) {
    if (entry.isFile() && !entry.name.startsWith(".")) {
      files.set(`${PHOTOS_DIR}/${entry.name}`, path.join(photosDir, entry.name));
    }
  }
  return files;
}

// ---------------------------------------------------------------------------
// Lecture SQLite
// ---------------------------------------------------------------------------

/**
 * Lit les tables de l'app iOS. La base (et ses éventuels fichiers -wal/-shm)
 * est d'abord copiée dans un dossier temporaire : la sauvegarde d'origine
 * n'est jamais ouverte en écriture, même par SQLite.
 */
export async function readLegacyDatabase(dbPath) {
  const { default: Database } = await import("better-sqlite3");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "myvine-legacy-"));
  try {
    const copy = path.join(tmp, LEGACY_DB_NAME);
    fs.copyFileSync(dbPath, copy);
    for (const suffix of ["-wal", "-shm"]) {
      if (fs.existsSync(dbPath + suffix)) fs.copyFileSync(dbPath + suffix, copy + suffix);
    }

    const db = new Database(copy);
    try {
      const versionRow = db
        .prepare(`SELECT value FROM meta WHERE key = 'db_version'`)
        .get();
      const dbVersion = versionRow ? parseInt(versionRow.value, 10) : null;
      if (dbVersion !== SUPPORTED_LEGACY_DB_VERSION) {
        throw new Error(
          `Version de base iOS inattendue : ${dbVersion} (attendu ${SUPPORTED_LEGACY_DB_VERSION}). ` +
            `Ouvrez l'app iOS une fois pour appliquer ses migrations, puis refaites la sauvegarde.`,
        );
      }
      return {
        dbVersion,
        caves: db.prepare(`SELECT * FROM caves ORDER BY id`).all(),
        cellar: db.prepare(`SELECT * FROM cellar ORDER BY id`).all(),
        wines: db.prepare(`SELECT * FROM wines ORDER BY id`).all(),
      };
    } finally {
      db.close();
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Transformation
// ---------------------------------------------------------------------------

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const LOCATION_TYPES = new Set(["home", "friend", "restaurant"]);
const CONTENT_TYPES = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
};

function isValidDate(value) {
  if (!DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function emptyToNull(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s === "" ? null : s;
}

function contentTypeFor(filename) {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
}

/** Ramène un photo_uri iOS (relatif, file:// ou absolu) à "wine-photos/<nom>". */
export function normalizePhotoUri(photoUri) {
  const uri = emptyToNull(photoUri);
  if (!uri) return null;
  const marker = `${PHOTOS_DIR}/`;
  const idx = uri.lastIndexOf(marker);
  if (idx === -1) return uri;
  return uri.slice(idx);
}

/**
 * Construit le plan d'import complet à partir des lignes SQLite et des photos
 * présentes sur disque. `errors` bloque l'import ; `warnings` est informatif.
 */
export function buildImportPlan(legacy, photoFiles) {
  const errors = [];
  const warnings = [];
  const photos = new Map(); // relatif → { blobPath, localPath, contentType }

  const now = new Date().toISOString();
  const ts = (value, label) => {
    const v = emptyToNull(value);
    if (v && !Number.isNaN(new Date(v).getTime())) return new Date(v).toISOString();
    warnings.push(`${label} : horodatage invalide « ${value} », remplacé par la date d'import.`);
    return now;
  };

  const resolvePhoto = (photoUri, label) => {
    const rel = normalizePhotoUri(photoUri);
    if (!rel) return null;
    const localPath = photoFiles.get(rel);
    if (!localPath) {
      warnings.push(`${label} : photo « ${photoUri} » absente de la sauvegarde, ignorée.`);
      return null;
    }
    if (!photos.has(rel)) {
      photos.set(rel, {
        legacyPath: rel,
        blobPath: rel,
        localPath,
        contentType: contentTypeFor(rel),
      });
    }
    return rel;
  };

  const caveIds = new Set(legacy.caves.map((c) => c.id));
  const cellarIds = new Set(legacy.cellar.map((c) => c.id));

  const caves = legacy.caves.map((row) => {
    const label = `Cave #${row.id}`;
    const name = emptyToNull(row.name);
    if (!name) errors.push(`${label} : nom vide.`);
    return {
      id: legacyUuid("cave", row.id),
      legacy_id: row.id,
      name: name ?? "",
      created_at: ts(row.created_at, label),
      updated_at: ts(row.updated_at, label),
    };
  });

  const cellarEntries = legacy.cellar.map((row) => {
    const label = `Bouteille en cave #${row.id} (${row.name})`;
    const name = emptyToNull(row.name);
    if (!name) errors.push(`${label} : nom vide.`);

    let caveId = null;
    if (row.cave_id !== null && row.cave_id !== undefined) {
      if (caveIds.has(row.cave_id)) caveId = legacyUuid("cave", row.cave_id);
      else warnings.push(`${label} : cave #${row.cave_id} inexistante, bouteille rattachée à aucune cave.`);
    }

    let purchaseDate = emptyToNull(row.purchase_date);
    if (purchaseDate && !isValidDate(purchaseDate)) {
      errors.push(`${label} : date d'achat invalide « ${purchaseDate} ».`);
      purchaseDate = null;
    }

    const intOrNull = (value, field) => {
      if (value === null || value === undefined || value === "") return null;
      const n = Number(value);
      if (!Number.isInteger(n)) {
        errors.push(`${label} : ${field} non entier « ${value} ».`);
        return null;
      }
      return n;
    };

    const price = row.purchase_price;
    let purchasePrice = null;
    if (price !== null && price !== undefined && price !== "") {
      purchasePrice = Number(price);
      if (!Number.isFinite(purchasePrice)) {
        errors.push(`${label} : prix d'achat invalide « ${price} ».`);
        purchasePrice = null;
      }
    }

    return {
      id: legacyUuid("cellar", row.id),
      legacy_id: row.id,
      cave_id: caveId,
      name: name ?? "",
      producer: emptyToNull(row.producer),
      appellation: emptyToNull(row.appellation),
      vintage: emptyToNull(row.vintage),
      quantity: intOrNull(row.quantity, "quantité") ?? 0,
      quantity_initial: intOrNull(row.quantity_initial, "quantité initiale") ?? 0,
      purchase_date: purchaseDate,
      purchase_price: purchasePrice,
      optimal_from: intOrNull(row.optimal_from, "apogée début"),
      optimal_to: intOrNull(row.optimal_to, "apogée fin"),
      storage_location: emptyToNull(row.storage_location),
      notes: emptyToNull(row.notes),
      photo_path: resolvePhoto(row.photo_uri, label),
      archived: row.archived === 1 || row.archived === true,
      created_at: ts(row.created_at, label),
      updated_at: ts(row.updated_at, label),
    };
  });

  const wines = legacy.wines.map((row) => {
    const label = `Dégustation #${row.id} (${row.name})`;
    const name = emptyToNull(row.name);
    if (!name) errors.push(`${label} : nom vide.`);

    const drunkAt = emptyToNull(row.drunk_at);
    if (!drunkAt || !isValidDate(drunkAt)) {
      errors.push(`${label} : date de dégustation invalide « ${row.drunk_at} ».`);
    }

    let vintage = null;
    if (row.vintage !== null && row.vintage !== undefined && row.vintage !== "") {
      const n = Number(row.vintage);
      if (Number.isInteger(n)) vintage = n;
      else errors.push(`${label} : millésime non entier « ${row.vintage} ».`);
    }

    let score = null;
    if (row.score !== null && row.score !== undefined && row.score !== "") {
      score = Number(row.score);
      if (!Number.isFinite(score)) {
        errors.push(`${label} : note invalide « ${row.score} ».`);
        score = null;
      }
    }

    const locationType = row.location_type ?? "home";
    if (!LOCATION_TYPES.has(locationType)) {
      errors.push(`${label} : lieu inconnu « ${locationType} ».`);
    }

    let cellarEntryId = null;
    if (row.cellar_id !== null && row.cellar_id !== undefined) {
      if (cellarIds.has(row.cellar_id)) cellarEntryId = legacyUuid("cellar", row.cellar_id);
      else warnings.push(`${label} : bouteille en cave #${row.cellar_id} inexistante, lien supprimé.`);
    }

    return {
      id: legacyUuid("wine", row.id),
      legacy_id: row.id,
      cellar_entry_id: cellarEntryId,
      name: name ?? "",
      producer: emptyToNull(row.producer),
      appellation: emptyToNull(row.appellation),
      vintage,
      score,
      location_type: locationType,
      restaurant_name: emptyToNull(row.restaurant_name),
      drunk_at: drunkAt,
      food_pairing: emptyToNull(row.food_pairing),
      photo_path: resolvePhoto(row.photo_uri, label),
      comment: emptyToNull(row.comment),
      companion: emptyToNull(row.companion),
      buy_again: row.buy_again === 1 || row.buy_again === true,
      created_at: ts(row.created_at, label),
      updated_at: ts(row.updated_at, label),
    };
  });

  const orphanPhotos = [...photoFiles.keys()].filter((rel) => !photos.has(rel));
  if (orphanPhotos.length > 0) {
    warnings.push(
      `${orphanPhotos.length} photo(s) présente(s) sur disque mais référencée(s) par aucune fiche — non importée(s).`,
    );
  }

  return {
    caves,
    cellarEntries,
    wines,
    photos: [...photos.values()],
    orphanPhotos,
    errors,
    warnings,
    counts: {
      caves: caves.length,
      cellarEntries: cellarEntries.length,
      wines: wines.length,
      photos: photos.size,
    },
  };
}

// ---------------------------------------------------------------------------
// Écriture en base (transaction unique, rejouable)
// ---------------------------------------------------------------------------

const COLUMNS = {
  cave: ["id", "legacy_id", "name", "created_at", "updated_at"],
  cellar_entry: [
    "id", "legacy_id", "cave_id", "name", "producer", "appellation", "vintage",
    "quantity", "quantity_initial", "purchase_date", "purchase_price",
    "optimal_from", "optimal_to", "storage_location", "notes", "photo_path",
    "archived", "created_at", "updated_at",
  ],
  wine: [
    "id", "legacy_id", "cellar_entry_id", "name", "producer", "appellation",
    "vintage", "score", "location_type", "restaurant_name", "drunk_at",
    "food_pairing", "photo_path", "comment", "companion", "buy_again",
    "created_at", "updated_at",
  ],
};

/** Requête INSERT paramétrée ; ON CONFLICT DO NOTHING rend l'import rejouable. */
export function insertStatement(table, row) {
  const cols = COLUMNS[table];
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
  return {
    text: `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
    values: cols.map((c) => row[c]),
  };
}

/**
 * Insère le plan dans une seule transaction (client `pg` déjà connecté).
 * Ordre imposé par les clés étrangères : cave → cellar_entry → wine.
 * Retourne le nombre de lignes réellement insérées par table.
 */
export async function writePlan(client, plan) {
  const inserted = { caves: 0, cellarEntries: 0, wines: 0 };
  await client.query("BEGIN");
  try {
    for (const row of plan.caves) {
      inserted.caves += (await client.query(insertStatement("cave", row))).rowCount;
    }
    for (const row of plan.cellarEntries) {
      inserted.cellarEntries += (await client.query(insertStatement("cellar_entry", row))).rowCount;
    }
    for (const row of plan.wines) {
      inserted.wines += (await client.query(insertStatement("wine", row))).rowCount;
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
  return inserted;
}

/** Compte les lignes importées présentes en base, pour comparaison avec la source. */
export async function countImported(client) {
  const count = async (table) =>
    Number(
      (await client.query(`SELECT count(*)::int AS n FROM ${table} WHERE legacy_id IS NOT NULL`))
        .rows[0].n,
    );
  return {
    caves: await count("cave"),
    cellarEntries: await count("cellar_entry"),
    wines: await count("wine"),
  };
}
