import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const db = {
  insertCave: vi.fn(),
  renameCave: vi.fn(),
  deleteCave: vi.fn(),
};
vi.mock("@/lib/db/caves", async () => {
  class CaveLimitError extends Error {}
  class CaveNotEmptyError extends Error {
    constructor(readonly bottleCount: number) {
      super("non vide");
    }
  }
  return {
    CaveLimitError,
    CaveNotEmptyError,
    insertCave: (...a: unknown[]) => db.insertCave(...a),
    renameCave: (...a: unknown[]) => db.renameCave(...a),
    deleteCave: (...a: unknown[]) => db.deleteCave(...a),
  };
});

import { POST } from "./route";
import { DELETE, PATCH } from "./[id]/route";
import { CaveLimitError, CaveNotEmptyError } from "@/lib/db/caves";

const ID = "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed";
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const json = (body: unknown, method = "POST") =>
  new Request("http://localhost/api/caves", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  Object.values(db).forEach((m) => m.mockReset());
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /api/caves", () => {
  it("creates a cave with a trimmed name", async () => {
    db.insertCave.mockResolvedValue(ID);
    const res = await POST(json({ name: "  Cave de Léa " }));
    expect(res.status).toBe(201);
    expect(db.insertCave).toHaveBeenCalledWith("Cave de Léa");
  });

  it("rejects an empty name", async () => {
    expect((await POST(json({ name: " " }))).status).toBe(400);
  });

  it("refuses a sixth cave", async () => {
    db.insertCave.mockRejectedValue(new CaveLimitError());
    const res = await POST(json({ name: "Une de trop" }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("5 caves maximum.");
  });
});

describe("PATCH /api/caves/[id]", () => {
  it("renames, or 404 when unknown", async () => {
    db.renameCave.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    expect((await PATCH(json({ name: "Bureau" }, "PATCH"), ctx(ID))).status).toBe(200);
    expect((await PATCH(json({ name: "Bureau" }, "PATCH"), ctx(ID))).status).toBe(404);
  });
});

describe("DELETE /api/caves/[id]", () => {
  it("explains why a non-empty cave cannot be deleted (message iOS)", async () => {
    db.deleteCave.mockRejectedValue(new CaveNotEmptyError(3));
    const res = await DELETE(json({}, "DELETE"), ctx(ID));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe(
      "Impossible de supprimer cette cave car elle contient 3 bouteilles.",
    );
  });

  it("deletes an empty cave", async () => {
    db.deleteCave.mockResolvedValue(true);
    expect((await DELETE(json({}, "DELETE"), ctx(ID))).status).toBe(200);
  });

  it("returns 404 for a malformed id", async () => {
    expect((await DELETE(json({}, "DELETE"), ctx("1"))).status).toBe(404);
    expect(db.deleteCave).not.toHaveBeenCalled();
  });
});
