import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

vi.mock("server-only", () => ({}));

// next/headers.cookies() ne fonctionne qu'en contexte requête Next.js ;
// on teste encrypt/decrypt directement, la primitive testable en isolation.
vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { encrypt, decrypt, assertSessionSecretConfigured } from "./session";

describe("session encrypt/decrypt", () => {
  const ORIGINAL_SECRET = process.env.SESSION_SECRET;
  const TEST_SECRET = Buffer.alloc(32, 1).toString("base64");

  beforeEach(() => {
    process.env.SESSION_SECRET = TEST_SECRET;
  });

  afterEach(() => {
    process.env.SESSION_SECRET = ORIGINAL_SECRET;
  });

  it("round-trips a valid payload", async () => {
    const token = await encrypt({ authenticated: true });
    const payload = await decrypt(token);
    expect(payload?.authenticated).toBe(true);
  });

  it("returns null for an undefined token", async () => {
    const payload = await decrypt(undefined);
    expect(payload).toBeNull();
  });

  it("returns null for a tampered token", async () => {
    const token = await encrypt({ authenticated: true });
    const tampered = token.slice(0, -2) + "xx";
    const payload = await decrypt(tampered);
    expect(payload).toBeNull();
  });

  it("returns null when signed with a different secret", async () => {
    const token = await encrypt({ authenticated: true });
    process.env.SESSION_SECRET = Buffer.alloc(32, 2).toString("base64");
    const payload = await decrypt(token);
    expect(payload).toBeNull();
  });

  it("rejects a weak session secret before issuing a token", async () => {
    process.env.SESSION_SECRET = "weak-secret";

    await expect(encrypt({ authenticated: true })).rejects.toThrow(
      "SESSION_SECRET must be a base64-encoded 32-byte random value",
    );
  });
});

describe("assertSessionSecretConfigured", () => {
  const ORIGINAL_SECRET = process.env.SESSION_SECRET;

  afterEach(() => {
    process.env.SESSION_SECRET = ORIGINAL_SECRET;
  });

  it("does not throw when SESSION_SECRET is a valid base64 32-byte value", () => {
    process.env.SESSION_SECRET = Buffer.alloc(32, 1).toString("base64");
    expect(() => assertSessionSecretConfigured()).not.toThrow();
  });

  it("throws when SESSION_SECRET is malformed", () => {
    process.env.SESSION_SECRET = "weak-secret";
    expect(() => assertSessionSecretConfigured()).toThrow(
      "SESSION_SECRET must be a base64-encoded 32-byte random value",
    );
  });

  it("throws when SESSION_SECRET is not set", () => {
    delete process.env.SESSION_SECRET;
    expect(() => assertSessionSecretConfigured()).toThrow(
      "SESSION_SECRET is not set",
    );
  });
});
