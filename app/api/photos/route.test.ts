import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

vi.mock("server-only", () => ({}));
const putMock = vi.fn();
vi.mock("@vercel/blob", () => ({
  put: (...args: unknown[]) => putMock(...args),
}));

import { POST } from "./route";

function upload(file: Blob | null, name = "photo.heic") {
  const form = new FormData();
  if (file) form.set("photo", file, name);
  return POST(new Request("http://localhost/api/photos", { method: "POST", body: form }));
}

async function image(width: number, height: number, format: "png" | "jpeg" = "png") {
  const buffer = await sharp({
    create: { width, height, channels: 3, background: "#7a2030" },
  })
    [format]()
    .toBuffer();
  return new Blob([new Uint8Array(buffer)]);
}

beforeEach(() => {
  putMock.mockReset().mockResolvedValue({});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /api/photos", () => {
  it("stores a normalised private JPEG under a unique name", async () => {
    const res = await upload(await image(3000, 1000));
    expect(res.status).toBe(201);
    const { photo_path } = await res.json();
    expect(photo_path).toMatch(/^wine-photos\/[0-9a-f-]{36}\.jpg$/);

    const [pathname, body, options] = putMock.mock.calls[0];
    expect(pathname).toBe(photo_path);
    expect(options).toMatchObject({ access: "private", contentType: "image/jpeg" });
    const meta = await sharp(body as Buffer).metadata();
    expect(meta.format).toBe("jpeg");
    expect(meta.width).toBe(2000); // réduite à 2000 px sur le grand côté
  });

  it("keeps small photos at their size", async () => {
    await upload(await image(800, 600, "jpeg"));
    const meta = await sharp(putMock.mock.calls[0][1] as Buffer).metadata();
    expect(meta.width).toBe(800);
  });

  it("rejects missing, oversized and non-image files", async () => {
    expect((await upload(null)).status).toBe(400);
    expect((await upload(new Blob([new Uint8Array(4_600_000)]))).status).toBe(413);
    expect((await upload(new Blob(["<html>"]))).status).toBe(415);
    expect(putMock).not.toHaveBeenCalled();
  });

  it("returns 503 when Blob is unavailable", async () => {
    putMock.mockRejectedValue(new Error("blob down"));
    expect((await upload(await image(100, 100))).status).toBe(503);
  });
});
