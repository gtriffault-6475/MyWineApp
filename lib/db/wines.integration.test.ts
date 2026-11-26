/**
 * Recherche de dégustations contre un vrai Postgres (migré).
 * Lancé seulement si TEST_DATABASE_URL est défini — la base est vidée.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: async () => {} }));

const url = process.env.TEST_DATABASE_URL;
if (url) process.env.DATABASE_URL = url;

describe.skipIf(!url)("searchWines", async () => {
  const { sql } = await import("./client");
  const { searchWines } = await import("./wines");
  const { DEFAULT_FILTERS } = await import("@/lib/wines/search");

  const names = async (filters: Partial<typeof DEFAULT_FILTERS>) =>
    (await searchWines({ ...DEFAULT_FILTERS, ...filters })).map((w) => w.name);

  beforeAll(async () => {
    await sql.query("DELETE FROM wine");
    await sql.query("DELETE FROM cellar_entry");
    await sql.query(`
      INSERT INTO wine (name, producer, vintage, score, location_type, restaurant_name, drunk_at, food_pairing, companion, buy_again) VALUES
        ('Morgon Côte du Py', 'Foillard', 2021, 7.5, 'home', NULL, '2025-10-12', NULL, 'Léa', true),
        ('Sancerre', 'Cotat', 2020, 8, 'restaurant', 'Le Comptoir', '2025-11-14', 'Huîtres', NULL, false),
        ('Crémant 100%', NULL, NULL, NULL, 'friend', NULL, '2025-01-31', NULL, NULL, false),
        ('Margaux', 'Château Margaux', 2015, 9.5, 'home', NULL, '2024-12-24', 'Côte de bœuf', 'Thomas', true)
    `);
  });

  afterAll(async () => {
    await sql.query("DELETE FROM wine");
  });

  it("returns everything, most recent first, by default", async () => {
    expect(await names({})).toEqual(["Sancerre", "Morgon Côte du Py", "Crémant 100%", "Margaux"]);
  });

  it("searches six fields, case-insensitively, accents included", async () => {
    expect(await names({ term: "CÔTE" })).toEqual(["Morgon Côte du Py", "Margaux"]); // nom + accord
    expect(await names({ term: "comptoir" })).toEqual(["Sancerre"]); // restaurant
    expect(await names({ term: "huîtres" })).toEqual(["Sancerre"]); // accord
    expect(await names({ term: "léa" })).toEqual(["Morgon Côte du Py"]); // avec qui
    expect(await names({ term: "cotat" })).toEqual(["Sancerre"]); // producteur
  });

  it("treats % and _ literally", async () => {
    expect(await names({ term: "100%" })).toEqual(["Crémant 100%"]);
    expect(await names({ term: "%" })).toEqual(["Crémant 100%"]);
    expect(await names({ term: "_" })).toEqual([]);
  });

  it("combines filters", async () => {
    expect(await names({ buyAgainOnly: true })).toEqual(["Morgon Côte du Py", "Margaux"]);
    expect(await names({ locationType: "restaurant" })).toEqual(["Sancerre"]);
    expect(await names({ scoreMin: 8, scoreMax: 9 })).toEqual(["Sancerre"]);
    expect(await names({ dateFrom: "2025-01-01", dateTo: "2025-10-31" })).toEqual([
      "Morgon Côte du Py",
      "Crémant 100%",
    ]);
    expect(await names({ buyAgainOnly: true, scoreMin: 9 })).toEqual(["Margaux"]);
  });

  it("sorts like the iOS app, unrated wines last for best score", async () => {
    expect(await names({ sortBy: "score_desc" })).toEqual([
      "Margaux", "Sancerre", "Morgon Côte du Py", "Crémant 100%",
    ]);
    expect(await names({ sortBy: "score_asc" })).toEqual([
      "Crémant 100%", "Morgon Côte du Py", "Sancerre", "Margaux",
    ]);
    expect(await names({ sortBy: "vintage_desc" })).toEqual([
      "Morgon Côte du Py", "Sancerre", "Margaux", "Crémant 100%",
    ]);
    expect(await names({ sortBy: "date_asc" })).toEqual([
      "Margaux", "Crémant 100%", "Morgon Côte du Py", "Sancerre",
    ]);
    expect((await names({ sortBy: "name_asc" }))[0]).toBe("Crémant 100%");
  });
});

describe.skipIf(!url)("getStats", async () => {
  const { sql } = await import("./client");
  const { getStats, buyAgainPercent } = await import("./stats");

  afterAll(async () => {
    await sql.query("DELETE FROM wine");
  });

  it("returns zeros on an empty journal", async () => {
    await sql.query("DELETE FROM wine");
    expect(await getStats()).toEqual({
      total: 0,
      avg_score: null,
      buy_again_count: 0,
      top_appellations: [],
      top_producers: [],
    });
  });

  it("computes totals, average (unrated ignored) and top 5", async () => {
    await sql.query("DELETE FROM wine");
    await sql.query(`
      INSERT INTO wine (name, producer, appellation, score, drunk_at, buy_again) VALUES
        ('A', 'Foillard', 'Morgon', 8, '2025-01-01', true),
        ('B', 'Foillard', 'Morgon', 6, '2025-01-02', false),
        ('C', 'Cotat', 'Sancerre', NULL, '2025-01-03', false),
        ('D', '', 'Chablis', 7, '2025-01-04', true)
    `);
    const stats = await getStats();
    expect(stats).toEqual({
      total: 4,
      avg_score: 7,
      buy_again_count: 2,
      top_appellations: [
        { label: "Morgon", count: 2 },
        { label: "Chablis", count: 1 },
        { label: "Sancerre", count: 1 },
      ],
      top_producers: [
        { label: "Foillard", count: 2 },
        { label: "Cotat", count: 1 },
      ],
    });
    expect(buyAgainPercent(stats)).toBe(50);
  });
});

describe.skipIf(!url)("exportAll", async () => {
  const { sql } = await import("./client");
  const { exportAll } = await import("./export");

  afterAll(async () => {
    await sql.query("DELETE FROM wine");
    await sql.query("DELETE FROM cellar_entry");
    await sql.query("DELETE FROM cave");
  });

  it("exports every table with typed values and ISO dates", async () => {
    await sql.query("DELETE FROM wine");
    await sql.query("DELETE FROM cellar_entry");
    await sql.query("DELETE FROM cave");
    const [{ id: caveId }] = (await sql.query(
      "INSERT INTO cave (name, legacy_id) VALUES ('Ma cave', 1) RETURNING id",
    )) as { id: string }[];
    const [{ id: entryId }] = (await sql.query(
      `INSERT INTO cellar_entry (cave_id, name, purchase_price, purchase_date, photo_path)
       VALUES ($1, 'Margaux', 24.9, '2020-03-14', 'wine-photos/a.jpg') RETURNING id`,
      [caveId],
    )) as { id: string }[];
    await sql.query(
      `INSERT INTO wine (name, drunk_at, score, cellar_entry_id) VALUES ('Margaux', '2025-01-01', 9.5, $1)`,
      [entryId],
    );

    const data = await exportAll();
    expect(data.caves).toEqual([
      expect.objectContaining({ id: caveId, legacy_id: 1, name: "Ma cave", created_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T.*Z$/) }),
    ]);
    expect(data.cellar_entries[0]).toMatchObject({
      cave_id: caveId,
      purchase_price: 24.9,
      purchase_date: "2020-03-14",
      archived: false,
    });
    expect(data.wines[0]).toMatchObject({ drunk_at: "2025-01-01", score: 9.5, cellar_entry_id: entryId });
  });
});
