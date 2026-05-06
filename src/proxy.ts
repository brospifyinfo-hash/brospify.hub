import { NextResponse, type NextRequest } from "next/server";

// ─── /admin and /api/admin gate ─────────────────────────────────
// Coarse-grained pre-flight: if there's no iron-session cookie we
// short-circuit before any route renders so an unauthenticated user
// never sees the admin shell. Fine-grained role enforcement still
// happens in the route handlers via `getSession()` — this proxy is
// defense-in-depth, not the only line of defence.
//
// Per the Next 16 proxy docs, sensitive auth checks should remain
// in handlers because matcher changes or Server Function moves can
// silently remove proxy coverage.

const SESSION_COOKIE = "brospify-session";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(SESSION_COOKIE);

  if (!hasSession) {
    if (pathname.startsWith("/api/admin")) {
      return NextResponse.json(
        { error: "Nicht eingeloggt." },
        { status: 401 },
      );
    }
    if (pathname.startsWith("/admin")) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      url.searchParams.set("redirect", pathname);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
