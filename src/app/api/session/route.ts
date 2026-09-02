import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  authConfigured,
  checkPassword,
  isAuthed,
  makeToken,
} from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Is the visitor already unlocked? Also reports whether a password is set at all. */
export async function GET() {
  return NextResponse.json({
    configured: authConfigured(),
    authed: await isAuthed(),
  });
}

/** Unlock with the shared password. */
export async function POST(req: Request) {
  if (!authConfigured()) {
    return NextResponse.json(
      { error: "ADMIN_PASSWORD is not configured on the server" },
      { status: 503 }
    );
  }
  let password = "";
  try {
    const body = (await req.json()) as { password?: string };
    password = body.password ?? "";
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  if (!password || !checkPassword(password)) {
    // Blunt the brute-force edge a little.
    await new Promise((r) => setTimeout(r, 600));
    return NextResponse.json({ error: "Onjuist wachtwoord" }, { status: 401 });
  }
  const res = NextResponse.json({ authed: true });
  res.cookies.set(SESSION_COOKIE, makeToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}

/** Lock again. */
export async function DELETE() {
  const res = NextResponse.json({ authed: false });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
