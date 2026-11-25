import { describe, expect, it } from "vitest";
import {
  filledStars,
  formatLongDate,
  formatShortDate,
  locationLabel,
  photoUrl,
  wineSubtitle,
  wineTitle,
} from "./wine";

describe("wineTitle", () => {
  it("appends the vintage when present", () => {
    expect(wineTitle({ name: "Margaux", vintage: 2015 })).toBe("Margaux 2015");
    expect(wineTitle({ name: "Crémant", vintage: null })).toBe("Crémant");
  });
});

describe("wineSubtitle", () => {
  it("joins producer and appellation, skipping empty values", () => {
    expect(wineSubtitle({ producer: "Dagueneau", appellation: "Pouilly-Fumé" })).toBe(
      "Dagueneau · Pouilly-Fumé",
    );
    expect(wineSubtitle({ producer: null, appellation: "Chablis" })).toBe("Chablis");
    expect(wineSubtitle({ producer: null, appellation: null })).toBeNull();
  });
});

describe("locationLabel", () => {
  it("shows the restaurant name when known", () => {
    expect(locationLabel({ location_type: "restaurant", restaurant_name: "Chez Paul" })).toBe(
      "Chez Paul",
    );
  });

  it("falls back to the location type label", () => {
    expect(locationLabel({ location_type: "restaurant", restaurant_name: null })).toBe("Restaurant");
    expect(locationLabel({ location_type: "home", restaurant_name: null })).toBe("À la maison");
    expect(locationLabel({ location_type: "friend", restaurant_name: "ignoré" })).toBe(
      "Chez des amis",
    );
  });
});

describe("dates", () => {
  it("formats calendar days in French, independent of time zone", () => {
    expect(formatShortDate("2024-12-24")).toBe("24 déc.");
    expect(formatLongDate("2024-12-24")).toBe("24 décembre 2024");
    expect(formatLongDate("2025-01-01")).toBe("1 janvier 2025");
  });

  it("returns an empty string for an invalid day", () => {
    expect(formatShortDate("pas une date")).toBe("");
  });
});

describe("filledStars", () => {
  it.each([
    [null, 0],
    [0, 0],
    [2, 1],
    [7, 4], // arrondi comme l'app iOS (Math.round(7 / 2) = 4)
    [9.5, 5],
    [10, 5],
  ])("score %s → %s étoile(s)", (score, stars) => {
    expect(filledStars(score)).toBe(stars);
  });
});

describe("photoUrl", () => {
  it("routes photos through the app, never to Blob directly", () => {
    expect(photoUrl("wine-photos/a b.jpg")).toBe("/api/photos/wine-photos/a%20b.jpg");
    expect(photoUrl("wine-photos/a.jpg", 160)).toBe("/api/photos/wine-photos/a.jpg?w=160");
    expect(photoUrl(null)).toBeNull();
  });
});
