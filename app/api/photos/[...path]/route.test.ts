import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

const getMock = vi.fn();
vi.mock("@vercel/blob", () => ({ get: (...args: unknown[]) => getMock(...args) }));

import { GET } from "./route";

function call(path: string[], query = "") {
  return GET(new Request(`http://localhost/api/photos/${path.join("/")}${query}`), {
    params: Promise.resolve({ path }),
  });
}

function blobOf(bytes: Uint8Array<ArrayBuffer>, contentType = "image/jpeg") {
  return {
    statusCode: 200,
    stream: new Response(bytes).body,
    blob: { contentType },
  };
}

beforeEach(() => {
  getMock.mockReset();
});

describe("GET /api/photos/[...path]", () => {
  it.each([
    [["secret", "file.jpg"]],
    [["wine-photos", "..", "x.jpg"]],
    [["wine-photos", ".hidden"]],
    [["wine-photos"]],
  ])("refuses paths outside wine-photos: %j", async (path) => {
    const res = await call(path);
    expect(res.status).toBe(404);
    expect(getMock).not.toHaveBeenCalled();
  });

  it("streams the original photo with long-lived private caching", async () => {
    getMock.mockResolvedValue(blobOf(new Uint8Array([1, 2, 3])));
    const res = await call(["wine-photos", "a.jpg"]);

    expect(getMock).toHaveBeenCalledWith("wine-photos/a.jpg", { access: "private" });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/jpeg");
    expect(res.headers.get("Cache-Control")).toContain("private");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("returns a WebP thumbnail when a supported width is requested", async () => {
    const jpeg = await sharp({
      create: { width: 600, height: 900, channels: 3, background: "#7a2030" },
    })
      .jpeg()
      .toBuffer();
    getMock.mockResolvedValue(blobOf(new Uint8Array(jpeg.buffer.slice(jpeg.byteOffset, jpeg.byteOffset + jpeg.byteLength) as ArrayBuffer)));

    const res = await call(["wine-photos", "a.jpg"], "?w=160");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/webp");
    const meta = await sharp(Buffer.from(await res.arrayBuffer())).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.width).toBe(160);
  });

  it("rejects arbitrary widths", async () => {
    const res = await call(["wine-photos", "a.jpg"], "?w=4000");
    expect(res.status).toBe(400);
    expect(getMock).not.toHaveBeenCalled();
  });

  it("returns 404 when the blob does not exist", async () => {
    getMock.mockResolvedValue(null);
    expect((await call(["wine-photos", "missing.jpg"])).status).toBe(404);
  });

  it("returns 503 when Blob is unreachable", async () => {
    getMock.mockRejectedValue(new Error("network"));
    expect((await call(["wine-photos", "a.jpg"])).status).toBe(503);
  });

  it("refuses non-image content", async () => {
    getMock.mockResolvedValue(blobOf(new Uint8Array([60]), "text/html"));
    expect((await call(["wine-photos", "a.jpg"])).status).toBe(415);
  });
});
