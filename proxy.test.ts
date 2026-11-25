import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { isPublicPath } from "./proxy";

describe("isPublicPath", () => {
  it.each([
    "/login",
    "/api/auth/login",
    "/favicon.ico",
    "/apple-icon.png",
    "/manifest.webmanifest",
    "/icon-512.png",
  ])("allows the explicit public path %s", (pathname) => {
    expect(isPublicPath(pathname)).toBe(true);
  });

  it.each([
    "/login-admin",
    "/login/reset",
    "/api/auth/login-history",
    "/api/auth/login/reset",
    "/caves",
    "/api/wines",
  ])("keeps the non-public path %s protected", (pathname) => {
    expect(isPublicPath(pathname)).toBe(false);
  });
});