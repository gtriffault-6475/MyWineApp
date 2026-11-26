import { describe, expect, it } from "vitest";
import {
  apogeeLabel,
  apogeeStatus,
  bottlesLabel,
  CellarInputSchema,
  emptyCellarForm,
  entryToForm,
  parsePrice,
  purchaseSummary,
  validateCellarForm,
  type CellarEntry,
  type CellarFormValues,
} from "./entry";

const NOW = new Date("2026-11-26T12:00:00");
const CAVE = "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed";

function form(overrides: Partial<CellarFormValues> = {}): CellarFormValues {
  return { ...emptyCellarForm(CAVE), name: "Margaux", ...overrides };
}

describe("apogée (règles iOS)", () => {
  it.each([
    [{ optimal_from: 2020, optimal_to: 2030 }, "2020 – 2030", "peak"],
    [{ optimal_from: 2030, optimal_to: null }, "À partir de 2030", "early"],
    [{ optimal_from: null, optimal_to: 2020 }, "Jusqu'en 2020", "past"],
    [{ optimal_from: null, optimal_to: null }, null, "unknown"],
  ] as const)("%j → %s / %s", (e, label, status) => {
    expect(apogeeLabel(e)).toBe(label);
    expect(apogeeStatus(e, 2026)).toBe(status);
  });
});

describe("libellés", () => {
  it("accorde « bouteille » comme iOS", () => {
    expect(bottlesLabel(0)).toBe("0 bouteilles");
    expect(bottlesLabel(1)).toBe("1 bouteille");
    expect(bottlesLabel(3)).toBe("3 bouteilles");
  });

  it("résume l'achat", () => {
    expect(purchaseSummary({ purchase_price: 24.9, purchase_date: "2020-03-14" })).toBe(
      "24.9 € · 14 mars 2020",
    );
    expect(purchaseSummary({ purchase_price: null, purchase_date: null })).toBeNull();
  });
});

describe("parsePrice", () => {
  it.each([
    ["", null],
    ["24", 24],
    ["24,90", 24.9],
    ["24.9", 24.9],
  ])("%j → %s", (raw, value) => {
    expect(parsePrice(raw)).toBe(value);
  });

  it("rejects malformed prices", () => {
    expect(parsePrice("vingt")).toBeNaN();
    expect(parsePrice("1.234")).toBeNaN();
  });
});

describe("validateCellarForm (règles iOS)", () => {
  it("accepts a minimal valid form", () => {
    expect(validateCellarForm(form(), NOW)).toEqual({});
  });

  it("checks name, quantity, vintage, apogee and price", () => {
    expect(
      validateCellarForm(
        form({
          name: " ",
          quantity: "0",
          vintage: "2032",
          optimal_from: "2035",
          optimal_to: "2030",
          purchase_price: "abc",
        }),
        NOW,
      ),
    ).toEqual({
      name: "Le nom est obligatoire",
      quantity: "Quantité invalide (min. 1)",
      vintage: "Millésime invalide (1800–2031)",
      optimal_to: "La fin doit être après le début",
      purchase_price: "Prix invalide",
    });
  });

  it("accepts a future vintage up to 5 years ahead (en primeur)", () => {
    expect(validateCellarForm(form({ vintage: "2031" }), NOW)).toEqual({});
  });
});

describe("CellarInputSchema", () => {
  it("normalises the form for the database", () => {
    expect(
      CellarInputSchema.parse(
        form({
          quantity: "6",
          vintage: "NV",
          purchase_price: "24,90",
          purchase_date: "2020-03-14",
          optimal_from: "2025",
          storage_location: " ",
        }),
      ),
    ).toMatchObject({
      cave_id: CAVE,
      quantity: 6,
      vintage: "NV",
      purchase_price: 24.9,
      purchase_date: "2020-03-14",
      optimal_from: 2025,
      optimal_to: null,
      storage_location: null,
    });
  });

  it.each([
    ["quantity", { quantity: "0" }],
    ["apogée inversée", { optimal_from: "2030", optimal_to: "2020" }],
    ["prix", { purchase_price: "x" }],
    ["date", { purchase_date: "14/03/2020" }],
    ["cave", { cave_id: "1" }],
  ])("rejects an invalid %s", (_label, overrides) => {
    expect(CellarInputSchema.safeParse(form(overrides)).success).toBe(false);
  });
});

describe("entryToForm", () => {
  it("round-trips an imported bottle", () => {
    const entry: CellarEntry = {
      id: CAVE,
      cave_id: CAVE,
      name: "Crémant",
      producer: null,
      appellation: null,
      vintage: "NV",
      quantity: 3,
      quantity_initial: 6,
      purchase_date: null,
      purchase_price: 12.5,
      optimal_from: null,
      optimal_to: 2027,
      storage_location: "Casier 2",
      notes: null,
      photo_path: null,
      archived: false,
    };
    const values = entryToForm(entry);
    expect(values).toMatchObject({ quantity: "3", purchase_price: "12.5", optimal_to: "2027" });
    expect(CellarInputSchema.parse(values)).toMatchObject({ quantity: 3, purchase_price: 12.5 });
  });
});
