import { describe, expect, it } from "vitest";
import {
  emptyWineForm,
  localToday,
  validateWineForm,
  WineInputSchema,
  wineToForm,
  type WineFormValues,
} from "./input";
import type { Wine } from "./wine";

const NOW = new Date("2026-11-25T12:00:00");

function form(overrides: Partial<WineFormValues> = {}): WineFormValues {
  return { ...emptyWineForm("2026-11-25"), name: "Margaux", ...overrides };
}

describe("localToday", () => {
  it("formats the local calendar day", () => {
    expect(localToday(new Date(2026, 0, 5, 23, 30))).toBe("2026-01-05");
  });
});

describe("validateWineForm (règles iOS)", () => {
  it("accepts a minimal valid form", () => {
    expect(validateWineForm(form(), NOW)).toEqual({});
  });

  it("requires a name", () => {
    expect(validateWineForm(form({ name: "  " }), NOW).name).toBe("Le nom du vin est obligatoire");
  });

  it.each(["1799", "2027", "20a5", "19.5"])("rejects vintage %s", (vintage) => {
    expect(validateWineForm(form({ vintage }), NOW).vintage).toBe("Millésime invalide (1800–2026)");
  });

  it("accepts an empty or plausible vintage", () => {
    expect(validateWineForm(form({ vintage: "" }), NOW)).toEqual({});
    expect(validateWineForm(form({ vintage: "2015" }), NOW)).toEqual({});
  });

  it.each(["", "25/11/2026", "2026-02-30"])("rejects date %j", (drunk_at) => {
    expect(validateWineForm(form({ drunk_at }), NOW).drunk_at).toBe(
      "Date invalide (format AAAA-MM-JJ)",
    );
  });
});

describe("WineInputSchema", () => {
  it("normalises the form into database values", () => {
    const parsed = WineInputSchema.parse(
      form({
        name: "  Sancerre ",
        producer: " ",
        vintage: "2020",
        score: 8,
        location_type: "restaurant",
        restaurant_name: " Chez Paul ",
        comment: "Minéral",
        buy_again: true,
      }),
    );
    expect(parsed).toMatchObject({
      name: "Sancerre",
      producer: null,
      vintage: 2020,
      score: 8,
      restaurant_name: "Chez Paul",
      comment: "Minéral",
      buy_again: true,
    });
  });

  it("drops the restaurant name when the tasting was not at a restaurant", () => {
    const parsed = WineInputSchema.parse(form({ location_type: "home", restaurant_name: "Oublié" }));
    expect(parsed.restaurant_name).toBeNull();
  });

  it("keeps imported decimal scores", () => {
    expect(WineInputSchema.parse(form({ score: 9.5 })).score).toBe(9.5);
  });

  it.each([
    ["name", { name: "" }],
    ["vintage", { vintage: "1700" }],
    ["score", { score: 11 }],
    ["drunk_at", { drunk_at: "demain" }],
    ["photo_path", { photo_path: "../secret.jpg" }],
    ["cellar_entry_id", { cellar_entry_id: "42" }],
  ])("rejects an invalid %s", (_field, overrides) => {
    expect(WineInputSchema.safeParse(form(overrides as Partial<WineFormValues>)).success).toBe(false);
  });
});

describe("wineToForm", () => {
  it("round-trips a stored tasting into editable values", () => {
    const wine: Wine = {
      id: "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed",
      name: "Margaux",
      producer: null,
      appellation: "Margaux",
      vintage: 2015,
      score: 9.5,
      location_type: "home",
      restaurant_name: null,
      drunk_at: "2025-11-20",
      food_pairing: null,
      photo_path: "wine-photos/a.jpg",
      comment: null,
      companion: "Léa",
      buy_again: true,
      cellar_entry_id: null,
      created_at: "",
      updated_at: "",
    };
    const values = wineToForm(wine);
    expect(values).toMatchObject({ producer: "", vintage: "2015", companion: "Léa" });
    expect(WineInputSchema.parse(values)).toMatchObject({ vintage: 2015, producer: null });
  });
});
