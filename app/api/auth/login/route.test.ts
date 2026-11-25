import { describe, expect, it, vi, beforeEach } from "vitest";

const { verifyPasswordMock, createSessionMock } = vi.hoisted(() => ({
  verifyPasswordMock: vi.fn(),
  createSessionMock: vi.fn(),
}));

vi.mock("@/lib/auth/password", () => ({ verifyPassword: verifyPasswordMock }));
vi.mock("@/lib/auth/session", () => ({ createSession: createSessionMock }));

import { POST } from "./route";

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    verifyPasswordMock.mockReset();
    createSessionMock.mockReset();
  });

  it("crée une session et répond ok: true si le mot de passe est correct", async () => {
    verifyPasswordMock.mockReturnValueOnce(true);

    const response = await POST(makeRequest({ password: "bon-mot-de-passe" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(createSessionMock).toHaveBeenCalledTimes(1);
  });

  it("401 si le mot de passe est incorrect, sans créer de session", async () => {
    verifyPasswordMock.mockReturnValueOnce(false);

    const response = await POST(makeRequest({ password: "mauvais" }));

    expect(response.status).toBe(401);
    expect(createSessionMock).not.toHaveBeenCalled();
  });

  it("401 si aucun mot de passe n'est fourni", async () => {
    const response = await POST(makeRequest({}));

    expect(response.status).toBe(401);
    expect(verifyPasswordMock).not.toHaveBeenCalled();
    expect(createSessionMock).not.toHaveBeenCalled();
  });

  it("401 si le corps de la requête est invalide", async () => {
    const response = await POST(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        body: "not json",
      }),
    );

    expect(response.status).toBe(401);
  });
});
