/**
 * Tests d'intégration SQL contre un vrai Postgres (migré).
 * Lancés seulement si TEST_DATABASE_URL est défini, par exemple :
 *   TEST_DATABASE_URL=postgres://… npx vitest run lib/db
 * La base est vidée : ne JAMAIS pointer vers la production.
 */
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: async () => {} }));

const url = process.env.TEST_DATABASE_URL;
if (url) process.env.DATABASE_URL = url;

describe.skipIf(!url)("SQL cave / cellar / wine", async () => {
  const { sql } = await import("./client");
  const caves = await import("./caves");
  const cellar = await import("./cellar");
  const wines = await import("./wines");
  const { CellarInputSchema, emptyCellarForm } = await import("@/lib/cellar/entry");

  const bottle = (caveId: string | null, overrides: Record<string, unknown> = {}) =>
    CellarInputSchema.parse({ ...emptyCellarForm(caveId), name: "Margaux", ...overrides });

  beforeEach(async () => {
    await sql.query("DELETE FROM wine");
    await sql.query("DELETE FROM cellar_entry");
    await sql.query("DELETE FROM cave");
  });

  afterAll(async () => {
    await sql.query("DELETE FROM wine");
    await sql.query("DELETE FROM cellar_entry");
    await sql.query("DELETE FROM cave");
  });

  it("limits caves to 5", async () => {
    for (let i = 0; i < 5; i++) await caves.insertCave(`Cave ${i}`);
    await expect(caves.insertCave("Une de trop")).rejects.toBeInstanceOf(caves.CaveLimitError);
    expect((await caves.listCaves()).map((c) => c.name)).toEqual([
      "Cave 0", "Cave 1", "Cave 2", "Cave 3", "Cave 4",
    ]);
  });

  it("counts only bottles still in the cave", async () => {
    const caveId = await caves.insertCave("Ma cave");
    await cellar.insertEntry(bottle(caveId));
    const archivedId = await cellar.insertEntry(bottle(caveId, { quantity: "1" }));
    await cellar.openBottle(archivedId);
    expect((await caves.getCave(caveId))?.bottle_count).toBe(1);
    expect((await cellar.listEntriesForCave(caveId)).length).toBe(1);
  });

  it("refuses to delete a non-empty cave, then deletes it once empty", async () => {
    const caveId = await caves.insertCave("Ma cave");
    const entryId = await cellar.insertEntry(bottle(caveId, { quantity: "1" }));
    await expect(caves.deleteCave(caveId)).rejects.toMatchObject({ bottleCount: 1 });

    await cellar.openBottle(entryId); // dernière bouteille → archivée
    expect(await caves.deleteCave(caveId)).toBe(true);
    expect(await caves.getCave(caveId)).toBeNull();
    // la bouteille archivée reste, sans cave
    expect((await cellar.getEntry(entryId))?.cave_id).toBeNull();
    expect(await caves.deleteCave(caveId)).toBe(false);
  });

  it("opens bottles one by one and archives the last one", async () => {
    const caveId = await caves.insertCave("Ma cave");
    const id = await cellar.insertEntry(bottle(caveId, { quantity: "2" }));
    expect(await cellar.openBottle(id)).toEqual({ quantity: 1, archived: false });
    expect(await cellar.openBottle(id)).toEqual({ quantity: 0, archived: true });
    expect(await cellar.openBottle(id)).toEqual({ quantity: 0, archived: true });
  });

  it("stores and reads back typed values", async () => {
    const caveId = await caves.insertCave("Ma cave");
    const id = await cellar.insertEntry(
      bottle(caveId, {
        vintage: "NV",
        quantity: "6",
        purchase_price: "24,90",
        purchase_date: "2020-03-14",
        optimal_from: "2025",
        optimal_to: "2035",
      }),
    );
    expect(await cellar.getEntry(id)).toMatchObject({
      vintage: "NV",
      quantity: 6,
      quantity_initial: 6,
      purchase_price: 24.9,
      purchase_date: "2020-03-14",
      optimal_from: 2025,
      optimal_to: 2035,
      archived: false,
    });
  });

  it("re-activates and resets the initial quantity on edit (comme iOS)", async () => {
    const caveId = await caves.insertCave("Ma cave");
    const id = await cellar.insertEntry(bottle(caveId, { quantity: "1" }));
    await cellar.openBottle(id);
    await cellar.updateEntry(id, bottle(caveId, { quantity: "3" }));
    expect(await cellar.getEntry(id)).toMatchObject({ quantity: 3, quantity_initial: 3, archived: false });
  });

  it("keeps a photo shared with a tasting when the bottle is deleted", async () => {
    const caveId = await caves.insertCave("Ma cave");
    const id = await cellar.insertEntry(bottle(caveId, { photo_path: "wine-photos/a.jpg" }));
    await sql.query(
      `INSERT INTO wine (name, drunk_at, photo_path, cellar_entry_id) VALUES ('Margaux', '2025-01-01', 'wine-photos/a.jpg', $1)`,
      [id],
    );
    expect(await cellar.deleteEntry(id)).toEqual({ orphanPhotoPath: null });
    // la dégustation reste, sans lien vers la cave
    const [wine] = (await sql.query("SELECT cellar_entry_id FROM wine")) as { cellar_entry_id: string | null }[];
    expect(wine.cellar_entry_id).toBeNull();
  });

  it("lists tastings linked to a bottle", async () => {
    const caveId = await caves.insertCave("Ma cave");
    const id = await cellar.insertEntry(bottle(caveId));
    await sql.query(
      `INSERT INTO wine (name, drunk_at, cellar_entry_id) VALUES ('A', '2025-01-01', $1), ('B', '2025-06-01', $1), ('C', '2025-03-01', NULL)`,
      [id],
    );
    expect((await wines.listWinesForEntry(id)).map((w) => w.name)).toEqual(["B", "A"]);
  });
});
