import { beforeEach, describe, expect, it, vi } from "vitest";

const deleteWineMock = vi.fn();
const delMock = vi.fn();
vi.mock("@/lib/db/wines", () => ({ deleteWine: (id: string) => deleteWineMock(id) }));
vi.mock("@vercel/blob", () => ({ del: (path: string) => delMock(path) }));

import { DELETE } from "./route";

const ID = "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed";

function call(id: string) {
  return DELETE(new Request(`http://localhost/api/wines/${id}`, { method: "DELETE" }), {
    params: Promise.resolve({ id }),
  });
}

beforeEach(() => {
  deleteWineMock.mockReset();
  delMock.mockReset().mockResolvedValue(undefined);
});

describe("DELETE /api/wines/[id]", () => {
  it("returns 404 for a malformed id without touching the database", async () => {
    expect((await call("42")).status).toBe(404);
    expect(deleteWineMock).not.toHaveBeenCalled();
  });

  it("returns 404 when the tasting does not exist", async () => {
    deleteWineMock.mockResolvedValue(null);
    expect((await call(ID)).status).toBe(404);
  });

  it("deletes the photo when no other record uses it", async () => {
    deleteWineMock.mockResolvedValue({ orphanPhotoPath: "wine-photos/a.jpg" });
    const res = await call(ID);
    expect(res.status).toBe(200);
    expect(delMock).toHaveBeenCalledWith("wine-photos/a.jpg");
  });

  it("keeps a photo still shared with a cellar bottle", async () => {
    deleteWineMock.mockResolvedValue({ orphanPhotoPath: null });
    expect((await call(ID)).status).toBe(200);
    expect(delMock).not.toHaveBeenCalled();
  });

  it("still succeeds if the photo cannot be removed from storage", async () => {
    deleteWineMock.mockResolvedValue({ orphanPhotoPath: "wine-photos/a.jpg" });
    delMock.mockRejectedValue(new Error("blob down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await call(ID)).status).toBe(200);
  });

  it("returns 503 when the database is unavailable", async () => {
    deleteWineMock.mockRejectedValue(new Error("db down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await call(ID)).status).toBe(503);
  });
});
