import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

vi.mock("server-only", () => ({}));
const getMock = vi.fn();
const parseMock = vi.fn();
vi.mock("@vercel/blob", () => ({ get: (...args: unknown[]) => getMock(...args) }));
vi.mock("@anthropic-ai/sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@anthropic-ai/sdk")>();
  class FakeAnthropic {
    messages = { parse: (...args: unknown[]) => parseMock(...args) };
    static RateLimitError = actual.default.RateLimitError;
    static AuthenticationError = actual.default.AuthenticationError;
  }
  return { default: FakeAnthropic };
});

import { POST } from "./route";

function recognize(photo_path: unknown) {
  return POST(
    new Request("http://localhost/api/recognize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photo_path }),
    }),
  );
}

async function storedPhoto() {
  const jpeg = await sharp({
    create: { width: 3000, height: 4000, channels: 3, background: "#ffffff" },
  })
    .jpeg()
    .toBuffer();
  return { statusCode: 200, stream: new Response(new Uint8Array(jpeg)).body };
}

beforeEach(() => {
  getMock.mockReset();
  parseMock.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /api/recognize", () => {
  it("sends a downscaled JPEG to Haiku and returns the cleaned fields", async () => {
    getMock.mockResolvedValue(await storedPhoto());
    parseMock.mockResolvedValue({
      stop_reason: "end_turn",
      parsed_output: {
        name: " Château Margaux ",
        producer: "Château Margaux",
        appellation: "",
        vintage: "vers 2015",
      },
    });

    const res = await recognize("wine-photos/a.jpg");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      name: "Château Margaux",
      producer: "Château Margaux",
      appellation: null,
      vintage: null, // pas 4 chiffres → ignoré, comme iOS
    });

    const request = parseMock.mock.calls[0][0];
    expect(request.model).toBe("claude-haiku-5-5");
    const image = request.messages[0].content[0];
    expect(image.source.media_type).toBe("image/jpeg");
    const meta = await sharp(Buffer.from(image.source.data, "base64")).metadata();
    expect(Math.max(meta.width!, meta.height!)).toBe(1568);
  });

  it("refuses paths outside wine-photos", async () => {
    expect((await recognize("../etc/passwd")).status).toBe(404);
    expect(getMock).not.toHaveBeenCalled();
  });

  it("returns 404 when the photo does not exist", async () => {
    getMock.mockResolvedValue(null);
    expect((await recognize("wine-photos/missing.jpg")).status).toBe(404);
  });

  it("reports a refusal clearly", async () => {
    getMock.mockResolvedValue(await storedPhoto());
    parseMock.mockResolvedValue({ stop_reason: "refusal", parsed_output: null });
    const res = await recognize("wine-photos/a.jpg");
    expect(res.status).toBe(422);
    expect((await res.json()).error).toContain("refusé");
  });

  it("returns 502 when the API fails", async () => {
    getMock.mockResolvedValue(await storedPhoto());
    parseMock.mockRejectedValue(new Error("network"));
    expect((await recognize("wine-photos/a.jpg")).status).toBe(502);
  });
});
