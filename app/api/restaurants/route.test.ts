import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { GET } from "./route";

const fetchMock = vi.fn();

function search(query: string) {
  return GET(new Request(`http://localhost/api/restaurants${query}`));
}

beforeEach(() => {
  process.env.FOURSQUARE_API_KEY = "fsq-test";
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GET /api/restaurants", () => {
  it("returns nothing for an empty query without calling Foursquare", async () => {
    expect(await (await search("?q=%20")).json()).toEqual({ results: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("queries Foursquare with the current API version and maps results", async () => {
    fetchMock.mockResolvedValue(
      Response.json({
        results: [
          { fsq_place_id: "p1", name: "Le Comptoir", location: { formatted_address: "9 Carrefour de l'Odéon" } },
          { fsq_id: "p2", name: "Chez Paul" },
        ],
      }),
    );
    const res = await search("?q=comptoir&ll=48.85,2.34");
    expect(await res.json()).toEqual({
      results: [
        { id: "p1", name: "Le Comptoir", address: "9 Carrefour de l'Odéon" },
        { id: "p2", name: "Chez Paul", address: null },
      ],
    });

    const [url, init] = fetchMock.mock.calls[0];
    const params = new URL(url).searchParams;
    expect(params.get("query")).toBe("comptoir");
    expect(params.get("ll")).toBe("48.85,2.34");
    expect(params.get("radius")).toBe("5000");
    expect(init.headers["X-Places-Api-Version"]).toBe("2025-06-17");
    expect(init.headers.Authorization).toBe("Bearer fsq-test");
  });

  it("ignores invalid coordinates", async () => {
    fetchMock.mockResolvedValue(Response.json({ results: [] }));
    await search("?q=x&ll=999,abc");
    expect(new URL(fetchMock.mock.calls[0][0]).searchParams.has("ll")).toBe(false);
  });

  it.each([
    [401, "Clé API Foursquare invalide"],
    [429, "Quota API dépassé (1 000 req/jour)"],
    [500, "Erreur API Foursquare (500)"],
  ])("maps HTTP %s to the iOS message", async (status, message) => {
    fetchMock.mockResolvedValue(new Response("", { status }));
    const res = await search("?q=x");
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe(message);
  });
});
