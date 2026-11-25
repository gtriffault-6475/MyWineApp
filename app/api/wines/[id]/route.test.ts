import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const deleteWineMock = vi.fn();
const updateWineMock = vi.fn();
const delMock = vi.fn();
vi.mock("@/lib/db/wines", () => ({
  deleteWine: (id: string) => deleteWineMock(id),
  updateWine: (id: string, input: unknown) => updateWineMock(id, input),
}));
vi.mock("@vercel/blob", () => ({ del: (path: string) => delMock(path) }));

import { DELETE, PUT } from "./route";

const ID = "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed";
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

const VALID = {
  name: "Sancerre",
  producer: "",
  appellation: "",
  vintage: "2020",
  score: 8,
  location_type: "home",
  restaurant_name: "",
  drunk_at: "2025-11-14",
  food_pairing: "",
  photo_path: "wine-photos/new.jpg",
  comment: "",
  companion: "",
  buy_again: false,
  cellar_entry_id: null,
};

function put(id: string, body: unknown) {
  return PUT(
    new Request(`http://localhost/api/wines/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    ctx(id),
  );
}

function remove(id: string) {
  return DELETE(new Request(`http://localhost/api/wines/${id}`, { method: "DELETE" }), ctx(id));
}

beforeEach(() => {
  deleteWineMock.mockReset();
  updateWineMock.mockReset();
  delMock.mockReset().mockResolvedValue(undefined);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("PUT /api/wines/[id]", () => {
  it("updates with normalised values", async () => {
    updateWineMock.mockResolvedValue({ orphanPhotoPath: null });
    const res = await put(ID, VALID);
    expect(res.status).toBe(200);
    expect(updateWineMock).toHaveBeenCalledWith(
      ID,
      expect.objectContaining({ name: "Sancerre", vintage: 2020, producer: null }),
    );
    expect(delMock).not.toHaveBeenCalled();
  });

  it("removes the replaced photo when no longer used", async () => {
    updateWineMock.mockResolvedValue({ orphanPhotoPath: "wine-photos/old.jpg" });
    expect((await put(ID, VALID)).status).toBe(200);
    expect(delMock).toHaveBeenCalledWith("wine-photos/old.jpg");
  });

  it("rejects an invalid form with its message", async () => {
    const res = await put(ID, { ...VALID, name: " " });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Le nom du vin est obligatoire");
    expect(updateWineMock).not.toHaveBeenCalled();
  });

  it("returns 404 for an unknown or malformed id", async () => {
    updateWineMock.mockResolvedValue(null);
    expect((await put(ID, VALID)).status).toBe(404);
    expect((await put("42", VALID)).status).toBe(404);
  });

  it("returns 503 when the database is unavailable", async () => {
    updateWineMock.mockRejectedValue(new Error("db down"));
    expect((await put(ID, VALID)).status).toBe(503);
  });
});

describe("DELETE /api/wines/[id]", () => {
  it("returns 404 for a malformed id without touching the database", async () => {
    expect((await remove("42")).status).toBe(404);
    expect(deleteWineMock).not.toHaveBeenCalled();
  });

  it("returns 404 when the tasting does not exist", async () => {
    deleteWineMock.mockResolvedValue(null);
    expect((await remove(ID)).status).toBe(404);
  });

  it("deletes the photo when no other record uses it", async () => {
    deleteWineMock.mockResolvedValue({ orphanPhotoPath: "wine-photos/a.jpg" });
    expect((await remove(ID)).status).toBe(200);
    expect(delMock).toHaveBeenCalledWith("wine-photos/a.jpg");
  });

  it("keeps a photo still shared with a cellar bottle", async () => {
    deleteWineMock.mockResolvedValue({ orphanPhotoPath: null });
    expect((await remove(ID)).status).toBe(200);
    expect(delMock).not.toHaveBeenCalled();
  });

  it("still succeeds if the photo cannot be removed from storage", async () => {
    deleteWineMock.mockResolvedValue({ orphanPhotoPath: "wine-photos/a.jpg" });
    delMock.mockRejectedValue(new Error("blob down"));
    expect((await remove(ID)).status).toBe(200);
  });

  it("returns 503 when the database is unavailable", async () => {
    deleteWineMock.mockRejectedValue(new Error("db down"));
    expect((await remove(ID)).status).toBe(503);
  });
});
