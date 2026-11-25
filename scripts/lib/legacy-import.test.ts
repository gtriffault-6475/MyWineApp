import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildImportPlan,
  insertStatement,
  legacyUuid,
  listPhotoFiles,
  locateLegacyFiles,
  normalizePhotoUri,
  readLegacyDatabase,
} from "./legacy-import.mjs";

// Schéma SQLite de l'app iOS à DB_VERSION 4 (copie de src/db/schema.ts du
// dépôt MyVineApp) — la fixture reproduit exactement la base réelle.
const IOS_SCHEMA = `
  CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE wines (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, producer TEXT,
    appellation TEXT, vintage INTEGER, score REAL,
    location_type TEXT NOT NULL DEFAULT 'home' CHECK(location_type IN ('home','friend','restaurant')),
    restaurant_name TEXT, drunk_at TEXT NOT NULL, food_pairing TEXT, photo_uri TEXT,
    comment TEXT, companion TEXT,
    buy_again INTEGER NOT NULL DEFAULT 0 CHECK(buy_again IN (0,1)), cellar_id INTEGER,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE TABLE cellar (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, producer TEXT,
    appellation TEXT, vintage TEXT, quantity INTEGER NOT NULL DEFAULT 1,
    quantity_initial INTEGER NOT NULL DEFAULT 1, purchase_date TEXT, purchase_price REAL,
    optimal_from INTEGER, optimal_to INTEGER, storage_location TEXT, notes TEXT,
    photo_uri TEXT, archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1)), cave_id INTEGER,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE TABLE caves (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
`;

let root: string;

/** Construit un faux conteneur Xcode : AppData/Library/LocalDatabase + Documents/wine-photos. */
function makeContainer(seed: (db: Database.Database) => void, photos: string[] = []) {
  const appData = path.join(root, "MyVine.xcappdata", "AppData");
  const dbDir = path.join(appData, "Library", "LocalDatabase");
  const photoDir = path.join(appData, "Documents", "wine-photos");
  fs.mkdirSync(dbDir, { recursive: true });
  fs.mkdirSync(photoDir, { recursive: true });
  const db = new Database(path.join(dbDir, "myvine.db"));
  db.exec(IOS_SCHEMA);
  db.prepare(`INSERT INTO meta VALUES ('db_version', '4')`).run();
  seed(db);
  db.close();
  for (const name of photos) fs.writeFileSync(path.join(photoDir, name), "jpeg-bytes");
  return path.join(root, "MyVine.xcappdata");
}

function seedTypical(db: Database.Database) {
  db.exec(`
    INSERT INTO caves (id, name) VALUES (1, 'Ma cave'), (2, 'Cave de Léa');
    INSERT INTO cellar (id, name, producer, vintage, quantity, quantity_initial,
      purchase_date, purchase_price, optimal_from, optimal_to, photo_uri, archived, cave_id)
    VALUES
      (1, 'Château Margaux', 'Château Margaux', '2015', 2, 6, '2020-03-14', 450.5, 2025, 2045,
       'wine-photos/a.jpg', 0, 1),
      (2, 'Crémant', NULL, 'NV', 0, 3, NULL, NULL, NULL, NULL, NULL, 1, 2);
    INSERT INTO wines (id, name, vintage, score, location_type, restaurant_name, drunk_at,
      photo_uri, comment, companion, buy_again, cellar_id)
    VALUES
      (1, 'Château Margaux', 2015, 9.5, 'home', NULL, '2024-12-24', 'wine-photos/a.jpg',
       'Très élégant, notes de cassis — « superbe »', 'Léa', 1, 1),
      (2, 'Sancerre', NULL, NULL, 'restaurant', 'Chez Paul', '2025-06-01', 'wine-photos/b.jpg',
       NULL, NULL, 0, NULL),
      (3, 'Crémant', NULL, 7, 'friend', '', '2025-01-01', NULL, '', NULL, 0, 2);
  `);
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "myvine-test-"));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe("legacyUuid", () => {
  it("is deterministic and distinct per table", () => {
    expect(legacyUuid("wine", 1)).toBe(legacyUuid("wine", 1));
    expect(legacyUuid("wine", 1)).not.toBe(legacyUuid("cellar", 1));
    expect(legacyUuid("wine", 1)).not.toBe(legacyUuid("wine", 2));
  });

  it("produces a valid RFC 4122 version 5 UUID", () => {
    expect(legacyUuid("cave", 42)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});

describe("normalizePhotoUri", () => {
  it.each([
    ["wine-photos/x.jpg", "wine-photos/x.jpg"],
    ["file:///var/mobile/Containers/Data/Application/ABC/Documents/wine-photos/x.jpg", "wine-photos/x.jpg"],
    ["/var/mobile/Documents/wine-photos/x.jpg", "wine-photos/x.jpg"],
    ["", null],
    [null, null],
  ])("%s → %s", (input, expected) => {
    expect(normalizePhotoUri(input)).toBe(expected);
  });
});

describe("locateLegacyFiles", () => {
  it("finds the database and photo folder inside an .xcappdata container", () => {
    const container = makeContainer(seedTypical, ["a.jpg"]);
    const { dbPath, photosDir } = locateLegacyFiles(container);
    expect(dbPath.endsWith(path.join("LocalDatabase", "myvine.db"))).toBe(true);
    expect(photosDir?.endsWith(path.join("Documents", "wine-photos"))).toBe(true);
  });

  it("fails clearly when no database is present", () => {
    fs.mkdirSync(path.join(root, "empty"));
    expect(() => locateLegacyFiles(path.join(root, "empty"))).toThrow("myvine.db introuvable");
  });
});

describe("readLegacyDatabase", () => {
  it("rejects an unexpected schema version", async () => {
    const container = makeContainer((db) => {
      db.prepare(`UPDATE meta SET value = '3' WHERE key = 'db_version'`).run();
    });
    const { dbPath } = locateLegacyFiles(container);
    await expect(readLegacyDatabase(dbPath)).rejects.toThrow("Version de base iOS inattendue : 3");
  });

  it("leaves the original backup file untouched", async () => {
    const container = makeContainer(seedTypical);
    const { dbPath } = locateLegacyFiles(container);
    const before = fs.readFileSync(dbPath);
    await readLegacyDatabase(dbPath);
    expect(fs.readFileSync(dbPath).equals(before)).toBe(true);
  });
});

describe("buildImportPlan", () => {
  async function planFor(seed: (db: Database.Database) => void, photos: string[] = []) {
    const container = makeContainer(seed, photos);
    const { dbPath, photosDir } = locateLegacyFiles(container);
    const legacy = await readLegacyDatabase(dbPath);
    return buildImportPlan(legacy, listPhotoFiles(photosDir));
  }

  it("maps every row and rewrites foreign keys to UUIDs", async () => {
    const plan = await planFor(seedTypical, ["a.jpg", "b.jpg"]);

    expect(plan.errors).toEqual([]);
    expect(plan.counts).toEqual({ caves: 2, cellarEntries: 2, wines: 3, photos: 2 });

    const margauxCellar = plan.cellarEntries[0];
    expect(margauxCellar.cave_id).toBe(legacyUuid("cave", 1));
    expect(margauxCellar.purchase_price).toBe(450.5);
    expect(margauxCellar.archived).toBe(false);
    expect(plan.cellarEntries[1].vintage).toBe("NV");
    expect(plan.cellarEntries[1].archived).toBe(true);

    const margauxWine = plan.wines[0];
    expect(margauxWine.id).toBe(legacyUuid("wine", 1));
    expect(margauxWine.cellar_entry_id).toBe(legacyUuid("cellar", 1));
    expect(margauxWine.buy_again).toBe(true);
    expect(margauxWine.comment).toBe("Très élégant, notes de cassis — « superbe »");
    expect(margauxWine.drunk_at).toBe("2024-12-24");
    expect(plan.wines[2].cellar_entry_id).toBe(legacyUuid("cellar", 2)); // bouteille archivée
  });

  it("normalises empty strings to null", async () => {
    const plan = await planFor(seedTypical, ["a.jpg", "b.jpg"]);
    expect(plan.wines[2].restaurant_name).toBeNull();
    expect(plan.wines[2].comment).toBeNull();
  });

  it("uploads a photo shared by a bottle and a tasting only once", async () => {
    const plan = await planFor(seedTypical, ["a.jpg", "b.jpg"]);
    expect(plan.photos.map((p) => p.blobPath).sort()).toEqual(["wine-photos/a.jpg", "wine-photos/b.jpg"]);
    expect(plan.photos[0].contentType).toBe("image/jpeg");
  });

  it("warns (without blocking) on missing and orphan photos", async () => {
    const plan = await planFor(seedTypical, ["a.jpg", "orphan.jpg"]);
    expect(plan.errors).toEqual([]);
    expect(plan.wines[1].photo_path).toBeNull();
    expect(plan.warnings.some((w) => w.includes("wine-photos/b.jpg") && w.includes("absente"))).toBe(true);
    expect(plan.orphanPhotos).toEqual(["wine-photos/orphan.jpg"]);
  });

  it("warns and unlinks when a referenced cave or bottle no longer exists", async () => {
    const plan = await planFor((db) => {
      db.exec(`
        INSERT INTO cellar (id, name, cave_id) VALUES (1, 'Orpheline', 99);
        INSERT INTO wines (id, name, drunk_at, cellar_id) VALUES (1, 'Vin', '2025-01-01', 77);
      `);
    });
    expect(plan.errors).toEqual([]);
    expect(plan.cellarEntries[0].cave_id).toBeNull();
    expect(plan.wines[0].cellar_entry_id).toBeNull();
    expect(plan.warnings).toHaveLength(2);
  });

  it("blocks on invalid dates instead of silently losing them", async () => {
    const plan = await planFor((db) => {
      db.exec(`
        INSERT INTO cellar (id, name, purchase_date) VALUES (1, 'X', '14/03/2020');
        INSERT INTO wines (id, name, drunk_at) VALUES (1, 'Y', '2025-02-30');
      `);
    });
    expect(plan.errors).toHaveLength(2);
    expect(plan.errors[0]).toContain("date d'achat invalide");
    expect(plan.errors[1]).toContain("date de dégustation invalide");
  });
});

describe("insertStatement", () => {
  it("builds a parameterised, idempotent insert", () => {
    const stmt = insertStatement("cave", {
      id: "u", legacy_id: 1, name: "Ma cave", created_at: "t1", updated_at: "t2",
    });
    expect(stmt.text).toBe(
      "INSERT INTO cave (id, legacy_id, name, created_at, updated_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING",
    );
    expect(stmt.values).toEqual(["u", 1, "Ma cave", "t1", "t2"]);
  });
});
