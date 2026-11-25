import "server-only";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";

const COOKIE_NAME = "myvine_session";
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 jours

function getSecretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is not set");
  }

  if (!/^[A-Za-z0-9+/]{43}=$/.test(secret)) {
    throw new Error(
      "SESSION_SECRET must be a base64-encoded 32-byte random value",
    );
  }

  const key = Buffer.from(secret, "base64");
  if (key.length !== 32) {
    throw new Error(
      "SESSION_SECRET must be a base64-encoded 32-byte random value",
    );
  }
  return key;
}

/** Valide SESSION_SECRET au démarrage plutôt qu'au premier login (voir instrumentation.ts). */
export function assertSessionSecretConfigured(): void {
  getSecretKey();
}

export interface SessionPayload extends JWTPayload {
  authenticated: true;
}

export async function encrypt(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor((Date.now() + SESSION_DURATION_MS) / 1000))
    .sign(getSecretKey());
}

export async function decrypt(
  token: string | undefined,
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify<SessionPayload>(
      token,
      getSecretKey(),
      { algorithms: ["HS256"] },
    );
    return payload;
  } catch {
    return null;
  }
}

/** Pose le cookie de session après vérification réussie du mot de passe. */
export async function createSession(): Promise<void> {
  const session = await encrypt({ authenticated: true });
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_MS / 1000,
  });
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

/** Vérification "optimiste" : lecture du cookie de session, sans appel base de données. */
export async function verifySession(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const payload = await decrypt(token);
  return payload?.authenticated === true;
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
