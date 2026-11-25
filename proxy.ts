import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decrypt, SESSION_COOKIE_NAME } from "@/lib/auth/session";

// Repris d'Euskara (AD-3) : liste noire minimale, tout le reste est protégé.
const PUBLIC_PATHS = new Set([
  "/login",
  "/api/auth/login",
  "/favicon.ico",
  "/icon.png",
  "/apple-icon.png",
  "/icon-192.png",
  "/icon-512.png",
  "/manifest.webmanifest",
]);

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.has(pathname);
}

export async function proxy(request: NextRequest) {
  if (isPublicPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await decrypt(token);

  if (session?.authenticated !== true) {
    if (request.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Session expirée. Reconnectez-vous." },
        { status: 401 },
      );
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
