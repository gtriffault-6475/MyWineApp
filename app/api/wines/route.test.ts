import { beforeEach, describe, expect, it, vi } from "vitest";

const insertWineMock = vi.fn();
vi.mock("@/lib/db/wines", () => ({ insertWine: (input: unknown) => insertWineMock(input) }));

import { POST } from "./route";

const VALID = {
  name: "Morgon",
  producer: "Foillard",
  appellation: "Morgon",
  vintage: "",
  score: null,
  location_type: "restaurant",
  restaurant_name: "Chez Paul",
  drunk_at: "2025-10-12",
  food_pairing: "",
  photo_path: null,
  comment: "",
  companion: "",
  buy_again: true,
  cellar_entry_id: null,
};

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/wines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  insertWineMock.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /api/wines", () => {
  it("creates a tasting and returns its id", async () => {
    insertWineMock.mockResolvedValue("new-id");
    const res = await post(VALID);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: "new-id" });
    expect(insertWineMock).toHaveBeenCalledWith(
      expect.objectContaining({ restaurant_name: "Chez Paul", vintage: null, buy_again: true }),
    );
  });

  it("rejects malformed JSON and invalid fields", async () => {
    expect((await post("pas du json")).status).toBe(400);
    expect((await post({ ...VALID, drunk_at: "hier" })).status).toBe(400);
    expect((await post({ ...VALID, location_type: "bateau" })).status).toBe(400);
    expect(insertWineMock).not.toHaveBeenCalled();
  });

  it("returns 503 when the database is unavailable", async () => {
    insertWineMock.mockRejectedValue(new Error("db down"));
    expect((await post(VALID)).status).toBe(503);
  });
});
