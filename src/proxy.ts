import { NextResponse, type NextRequest } from "next/server";

// ─── /admin and /api/admin gate ─────────────────────────────────
// Coarse-grained pre-flight: if there's no iron-session cookie AND no
// Authorization bearer (used by Vercel Cron) we short-circuit before
// any route renders. Fine-grained role enforcement still happens in
// the route handlers via `getSession()` — this proxy is defense-in-
// depth, not the only line of defence.
//
// Per the Next 16 proxy docs, sensitive auth checks should remain
// in handlers because matcher changes or Server Function moves can
// silently remove proxy coverage.

const SESSION_COOKIE = "brospify-session";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(SESSION_COOKIE);
  // Bearer auth header path — Vercel Cron + external triggers come
  // through here. The actual token comparison lives in the route
  // handler (see backfill-starter/route.ts); proxy only checks that
  // *some* credential is present.
  const hasBearer = (request.headers.get("authorization") || "").startsWith("Bearer ");

  if (!hasSession && !hasBearer) {
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
