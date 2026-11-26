import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const db = {
  insertEntry: vi.fn(),
  updateEntry: vi.fn(),
  deleteEntry: vi.fn(),
  openBottle: vi.fn(),
};
const delMock = vi.fn();
vi.mock("@/lib/db/cellar", () => ({
  insertEntry: (...a: unknown[]) => db.insertEntry(...a),
  updateEntry: (...a: unknown[]) => db.updateEntry(...a),
  deleteEntry: (...a: unknown[]) => db.deleteEntry(...a),
  openBottle: (...a: unknown[]) => db.openBottle(...a),
}));
vi.mock("@vercel/blob", () => ({ del: (p: string) => delMock(p) }));

import { POST } from "./route";
import { DELETE, PUT } from "./[id]/route";
import { POST as OPEN } from "./[id]/open/route";

const ID = "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed";
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const FORM = {
  cave_id: ID,
  name: "Margaux",
  producer: "",
  appellation: "",
  vintage: "2015",
  quantity: "6",
  purchase_date: "",
  purchase_price: "450,50",
  optimal_from: "2025",
  optimal_to: "2045",
  storage_location: "Casier 3",
  notes: "",
  photo_path: null,
};
const req = (body: unknown, method: string) =>
  new Request("http://localhost/api/cellar", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  Object.values(db).forEach((m) => m.mockReset());
  delMock.mockReset().mockResolvedValue(undefined);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /api/cellar", () => {
  it("adds a bottle with typed values", async () => {
    db.insertEntry.mockResolvedValue(ID);
    const res = await POST(req(FORM, "POST"));
    expect(res.status).toBe(201);
    expect(db.insertEntry).toHaveBeenCalledWith(
      expect.objectContaining({ quantity: 6, purchase_price: 450.5, optimal_to: 2045, producer: null }),
    );
  });

  it("rejects an invalid bottle", async () => {
    const res = await POST(req({ ...FORM, quantity: "0" }, "POST"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Quantité invalide (min. 1)");
  });

  it("returns 503 when the database is down", async () => {
    db.insertEntry.mockRejectedValue(new Error("down"));
    expect((await POST(req(FORM, "POST"))).status).toBe(503);
  });
});

describe("PUT / DELETE /api/cellar/[id]", () => {
  it("updates and cleans the replaced photo", async () => {
    db.updateEntry.mockResolvedValue({ orphanPhotoPath: "wine-photos/old.jpg" });
    expect((await PUT(req(FORM, "PUT"), ctx(ID))).status).toBe(200);
    expect(delMock).toHaveBeenCalledWith("wine-photos/old.jpg");
  });

  it("returns 404 for unknown bottles", async () => {
    db.updateEntry.mockResolvedValue(null);
    db.deleteEntry.mockResolvedValue(null);
    expect((await PUT(req(FORM, "PUT"), ctx(ID))).status).toBe(404);
    expect((await DELETE(req({}, "DELETE"), ctx(ID))).status).toBe(404);
  });

  it("deletes a bottle and its unused photo", async () => {
    db.deleteEntry.mockResolvedValue({ orphanPhotoPath: "wine-photos/a.jpg" });
    expect((await DELETE(req({}, "DELETE"), ctx(ID))).status).toBe(200);
    expect(delMock).toHaveBeenCalledWith("wine-photos/a.jpg");
  });
});

describe("POST /api/cellar/[id]/open", () => {
  it("returns the remaining quantity and archive state", async () => {
    db.openBottle.mockResolvedValue({ quantity: 0, archived: true });
    const res = await OPEN(req({}, "POST"), ctx(ID));
    expect(await res.json()).toEqual({ quantity: 0, archived: true });
  });

  it("returns 404 for unknown or malformed ids", async () => {
    db.openBottle.mockResolvedValue(null);
    expect((await OPEN(req({}, "POST"), ctx(ID))).status).toBe(404);
    expect((await OPEN(req({}, "POST"), ctx("x"))).status).toBe(404);
  });
});
