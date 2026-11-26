import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  extractFromFinderBackup,
  FinderBackupError,
  isFinderBackup,
  resolveDeviceBackup,
} from "./finder-backup.mjs";
import {
  buildImportPlan,
  listPhotoFiles,
  locateLegacyFiles,
  readLegacyDatabase,
} from "./legacy-import.mjs";

const DOMAIN = "AppDomain-com.myvineapp";
let root: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "finder-test-"));
});
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

/** Base SQLite minimale au schéma iOS v4 (une cave, une dégustation). */
function legacyDb(): Buffer {
  const file = path.join(fs.mkdtempSync(path.join(root, "db-")), "legacy.db");
  const db = new Database(file);
  db.exec(`
    CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    INSERT INTO meta VALUES ('db_version', '4');
    CREATE TABLE caves (id INTEGER PRIMARY KEY, name TEXT NOT NULL, created_at TEXT, updated_at TEXT);
    CREATE TABLE cellar (id INTEGER PRIMARY KEY, name TEXT NOT NULL, producer TEXT, appellation TEXT,
      vintage TEXT, quantity INTEGER NOT NULL DEFAULT 1, quantity_initial INTEGER NOT NULL DEFAULT 1,
      purchase_date TEXT, purchase_price REAL, optimal_from INTEGER, optimal_to INTEGER,
      storage_location TEXT, notes TEXT, photo_uri TEXT, archived INTEGER NOT NULL DEFAULT 0,
      cave_id INTEGER, created_at TEXT, updated_at TEXT);
    CREATE TABLE wines (id INTEGER PRIMARY KEY, name TEXT NOT NULL, producer TEXT, appellation TEXT,
      vintage INTEGER, score REAL, location_type TEXT NOT NULL DEFAULT 'home', restaurant_name TEXT,
      drunk_at TEXT NOT NULL, food_pairing TEXT, photo_uri TEXT, comment TEXT, companion TEXT,
      buy_again INTEGER NOT NULL DEFAULT 0, cellar_id INTEGER, created_at TEXT, updated_at TEXT);
    INSERT INTO caves (id, name, created_at, updated_at) VALUES (1, 'Ma cave', '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z');
    INSERT INTO wines (id, name, drunk_at, photo_uri, created_at, updated_at)
      VALUES (1, 'Sancerre', '2025-06-01', 'wine-photos/a.jpg', '2025-06-01T20:00:00Z', '2025-06-01T20:00:00Z');
  `);
  db.close();
  return fs.readFileSync(file);
}

/** Fabrique une sauvegarde Finder comme iOS : fileID = sha1(domaine-chemin). */
function makeBackup(
  name: string,
  files: Record<string, Buffer | null>,
  options: { domain?: string; encrypted?: boolean } = {},
): string {
  const dir = path.join(root, "Backup", name);
  fs.mkdirSync(dir, { recursive: true });
  const domain = options.domain ?? DOMAIN;
  if (options.encrypted) {
    fs.writeFileSync(path.join(dir, "Manifest.db"), Buffer.from("not sqlite at all, encrypted bytes"));
    return dir;
  }
  const manifest = new Database(path.join(dir, "Manifest.db"));
  manifest.exec(
    "CREATE TABLE Files (fileID TEXT PRIMARY KEY, domain TEXT, relativePath TEXT, flags INTEGER, file BLOB)",
  );
  const insert = manifest.prepare("INSERT INTO Files VALUES (?, ?, ?, ?, NULL)");
  insert.run(createHash("sha1").update(`${domain}-Documents`).digest("hex"), domain, "Documents", 2);
  for (const [relativePath, content] of Object.entries(files)) {
    const fileID = createHash("sha1").update(`${domain}-${relativePath}`).digest("hex");
    insert.run(fileID, domain, relativePath, 1);
    if (content) {
      fs.mkdirSync(path.join(dir, fileID.slice(0, 2)), { recursive: true });
      fs.writeFileSync(path.join(dir, fileID.slice(0, 2), fileID), content);
    }
  }
  // Un fichier d'une autre app, qui ne doit pas être extrait.
  insert.run("ff".repeat(20), "AppDomain-com.other", "Documents/wine-photos/x.jpg", 1);
  manifest.close();
  return dir;
}

describe("extractFromFinderBackup", () => {
  it("rebuilds the app layout and feeds the regular import", async () => {
    const backup = makeBackup("00008110-AAAA", {
      "Library/LocalDatabase/myvine.db": legacyDb(),
      "Documents/wine-photos/a.jpg": Buffer.from("jpeg"),
    });
    expect(isFinderBackup(backup)).toBe(true);

    const extracted = await extractFromFinderBackup(backup);
    try {
      expect(extracted.missing).toEqual([]);
      const { dbPath, photosDir } = locateLegacyFiles(extracted.dir);
      expect(dbPath.endsWith(path.join("AppData", "Library", "LocalDatabase", "myvine.db"))).toBe(true);
      const plan = buildImportPlan(await readLegacyDatabase(dbPath), listPhotoFiles(photosDir));
      expect(plan.errors).toEqual([]);
      expect(plan.counts).toEqual({ caves: 1, cellarEntries: 0, wines: 1, photos: 1 });
      // seule la photo de MyVine a été extraite
      expect(fs.readdirSync(photosDir!)).toEqual(["a.jpg"]);
    } finally {
      extracted.cleanup();
    }
    expect(fs.existsSync(extracted.dir)).toBe(false);
  });

  it("reports indexed files missing from disk instead of failing", async () => {
    const backup = makeBackup("dev", {
      "Library/LocalDatabase/myvine.db": legacyDb(),
      "Documents/wine-photos/a.jpg": null,
    });
    const extracted = await extractFromFinderBackup(backup);
    extracted.cleanup();
    expect(extracted.missing).toEqual(["Documents/wine-photos/a.jpg"]);
  });

  it("picks the most recent device backup containing MyVine from the Backup folder", async () => {
    makeBackup("autre-iphone", { "Library/x.db": Buffer.from("x") }, { domain: "AppDomain-com.other" });
    const old = makeBackup("iphone-ancien", { "Library/LocalDatabase/myvine.db": legacyDb() });
    const recent = makeBackup("iphone-recent", { "Library/LocalDatabase/myvine.db": legacyDb() });
    fs.utimesSync(path.join(old, "Manifest.db"), new Date("2024-01-01"), new Date("2024-01-01"));
    expect(await resolveDeviceBackup(path.join(root, "Backup"))).toBe(recent);
  });

  it("explains how to fix an encrypted backup", async () => {
    const backup = makeBackup("chiffree", {}, { encrypted: true });
    await expect(extractFromFinderBackup(backup)).rejects.toThrow(/chiffrée.*Chiffrer la sauvegarde locale/);
  });

  it("detects encryption from an XML Manifest.plist", async () => {
    const backup = makeBackup("plist", { "Library/LocalDatabase/myvine.db": legacyDb() });
    fs.writeFileSync(
      path.join(backup, "Manifest.plist"),
      "<plist><dict><key>IsEncrypted</key>\n<true/></dict></plist>",
    );
    await expect(extractFromFinderBackup(backup)).rejects.toBeInstanceOf(FinderBackupError);
  });

  it("fails clearly when MyVine is not in the backup", async () => {
    const backup = makeBackup("sans-app", { "Documents/notes.txt": Buffer.from("x") });
    await expect(extractFromFinderBackup(backup)).rejects.toThrow(/base de MyVine.*absente/);
    await expect(resolveDeviceBackup(path.join(root, "vide"))).rejects.toThrow(/Aucune sauvegarde/);
  });
});
