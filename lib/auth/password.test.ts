import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { verifyPassword, assertAppPasswordConfigured } from "./password";

describe("verifyPassword", () => {
  const ORIGINAL_ENV = process.env.APP_PASSWORD;

  beforeEach(() => {
    process.env.APP_PASSWORD = "correct-horse-battery-staple";
  });

  afterEach(() => {
    process.env.APP_PASSWORD = ORIGINAL_ENV;
  });

  it("returns true for the correct password", () => {
    expect(verifyPassword("correct-horse-battery-staple")).toBe(true);
  });

  it("returns false for an incorrect password", () => {
    expect(verifyPassword("wrong-password")).toBe(false);
  });

  it("returns false for an empty string", () => {
    expect(verifyPassword("")).toBe(false);
  });

  it("throws if APP_PASSWORD is not configured", () => {
    delete process.env.APP_PASSWORD;
    expect(() => verifyPassword("anything")).toThrow("APP_PASSWORD is not set");
  });
});

describe("assertAppPasswordConfigured", () => {
  const ORIGINAL_ENV = process.env.APP_PASSWORD;

  afterEach(() => {
    process.env.APP_PASSWORD = ORIGINAL_ENV;
  });

  it("does not throw when APP_PASSWORD is set", () => {
    process.env.APP_PASSWORD = "correct-horse-battery-staple";
    expect(() => assertAppPasswordConfigured()).not.toThrow();
  });

  it("throws if APP_PASSWORD is not configured", () => {
    delete process.env.APP_PASSWORD;
    expect(() => assertAppPasswordConfigured()).toThrow("APP_PASSWORD is not set");
  });
});
