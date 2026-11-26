import { beforeEach, describe, expect, it, vi } from "vitest";

const exportAllMock = vi.fn();
vi.mock("@/lib/db/export", () => ({ exportAll: () => exportAllMock() }));

import { GET } from "./route";

beforeEach(() => {
  exportAllMock.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("GET /api/export", () => {
  it("returns versioned data with counts and the photos to fetch", async () => {
    exportAllMock.mockResolvedValue({
      caves: [{ id: "c1" }],
      cellar_entries: [{ id: "b1", photo_path: "wine-photos/a.jpg" }],
      wines: [
        { id: "w1", photo_path: "wine-photos/a.jpg" },
        { id: "w2", photo_path: null },
      ],
    });
    const res = await GET();
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const data = await res.json();
    expect(data).toMatchObject({
      format: "myvine-export",
      version: 1,
      counts: { caves: 1, cellar_entries: 1, wines: 2, photos: 1 },
      photos: ["wine-photos/a.jpg"],
    });
    expect(Date.parse(data.exported_at)).not.toBeNaN();
  });

  it("returns 503 when the database is unavailable", async () => {
    exportAllMock.mockRejectedValue(new Error("down"));
    expect((await GET()).status).toBe(503);
  });
});
