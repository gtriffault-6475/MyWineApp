import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import {
  archiveFileName,
  buildArchive,
  EXPORT_FORMAT,
  EXPORT_VERSION,
  referencedPhotos,
  type ExportData,
} from "./archive";

const DATA: ExportData = {
  format: EXPORT_FORMAT,
  version: EXPORT_VERSION,
  exported_at: "2026-11-26T18:00:00.000Z",
  counts: { caves: 1, cellar_entries: 1, wines: 2, photos: 2 },
  caves: [{ id: "c1", name: "Ma cave" }],
  cellar_entries: [{ id: "b1", name: "Margaux", photo_path: "wine-photos/a.jpg" }],
  wines: [
    { id: "w1", name: "Margaux", photo_path: "wine-photos/a.jpg", comment: "Très « élégant »" },
    { id: "w2", name: "Sancerre", photo_path: "wine-photos/b.jpg" },
  ],
  photos: ["wine-photos/a.jpg", "wine-photos/b.jpg"],
};

describe("referencedPhotos", () => {
  it("dedupes photos shared between a bottle and a tasting", () => {
    expect(referencedPhotos([...DATA.cellar_entries, ...DATA.wines, { photo_path: null }])).toEqual([
      "wine-photos/a.jpg",
      "wine-photos/b.jpg",
    ]);
  });
});

describe("archiveFileName", () => {
  it("uses the local date", () => {
    expect(archiveFileName(new Date(2026, 0, 5, 23, 59))).toBe("myvine-sauvegarde-2026-01-05.zip");
  });
});

describe("buildArchive", () => {
  it("packs the JSON and every photo, readable back unchanged", () => {
    const photos = new Map([
      ["wine-photos/a.jpg", new Uint8Array([1, 2, 3])],
      ["wine-photos/b.jpg", new Uint8Array([4, 5])],
    ]);
    const { zip, missing } = buildArchive(DATA, photos);
    expect(missing).toEqual([]);

    const files = unzipSync(zip);
    expect(Object.keys(files).sort()).toEqual(["myvine-export.json", "photos/a.jpg", "photos/b.jpg"]);
    expect([...files["photos/a.jpg"]]).toEqual([1, 2, 3]);
    const json = JSON.parse(strFromU8(files["myvine-export.json"]));
    expect(json).toMatchObject({ format: "myvine-export", version: 1, missing_photos: [] });
    expect(json.wines[0].comment).toBe("Très « élégant »");
  });

  it("lists photos that could not be downloaded instead of failing", () => {
    const { zip, missing } = buildArchive(DATA, new Map([["wine-photos/a.jpg", new Uint8Array([1])]]));
    expect(missing).toEqual(["wine-photos/b.jpg"]);
    const json = JSON.parse(strFromU8(unzipSync(zip)["myvine-export.json"]));
    expect(json.missing_photos).toEqual(["wine-photos/b.jpg"]);
  });
});
