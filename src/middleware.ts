import { NextResponse, type NextRequest } from "next/server";

/**
 * Site-wide password gate.
 *
 * Every page is protected, not just /prijzen — the admin also shows purchase
 * prices on /overzicht and /catalogus, which shouldn't be public either.
 *
 * Runs on the edge, so it verifies the session cookie with Web Crypto rather
 * than node's crypto module. The cookie is `<expiry>.<hmac(expiry)>`, matching
 * what src/lib/auth.ts issues.
 *
 * With no ADMIN_PASSWORD configured the gate is off and everything is open.
 */

const COOKIE = "rb_session";

const OPEN_PATHS = [
  "/login",
  "/api/session",   // needed to log in
  "/_next",
  "/favicon",
  "/robots.txt",
  "/sitemap.xml",
];

function secret(): string {
  return process.env.SESSION_SECRET ?? process.env.ADMIN_PASSWORD ?? "";
}

async function hmac(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function valid(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const [expires, sig] = token.split(".");
  if (!expires || !sig) return false;
  if (Number(expires) < Date.now()) return false;
  const expected = await hmac(expires);
  // Constant-time-ish compare; lengths are fixed so a simple XOR fold is fine.
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}

export async function middleware(req: NextRequest) {
  if (!process.env.ADMIN_PASSWORD) return NextResponse.next();

  const { pathname, search } = req.nextUrl;
  if (OPEN_PATHS.some((p) => pathname.startsWith(p))) return NextResponse.next();

  if (await valid(req.cookies.get(COOKIE)?.value)) return NextResponse.next();

  // API calls get a clean 401; pages get sent to the login screen.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
