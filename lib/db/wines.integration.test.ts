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
