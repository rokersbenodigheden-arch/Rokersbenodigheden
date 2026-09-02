import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

/**
 * Minimal password gate for the price editor.
 *
 * ADMIN_PASSWORD guards the page; SESSION_SECRET signs the cookie so a visitor
 * can't forge one. Both are Vercel environment variables — neither reaches the
 * browser. The cookie holds a signed expiry, never the password itself.
 */

const COOKIE = "rb_session";
const MAX_AGE = 60 * 60 * 12; // 12 hours

function secret(): string {
  return process.env.SESSION_SECRET ?? process.env.ADMIN_PASSWORD ?? "";
}

export function authConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD);
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function checkPassword(given: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  return safeEqual(given, expected);
}

export function makeToken(): string {
  const expires = Date.now() + MAX_AGE * 1000;
  return `${expires}.${sign(String(expires))}`;
}

export function tokenValid(token: string | undefined): boolean {
  if (!token) return false;
  const [expires, sig] = token.split(".");
  if (!expires || !sig) return false;
  if (Number(expires) < Date.now()) return false;
  return safeEqual(sig, sign(expires));
}

/**
 * With no ADMIN_PASSWORD set the gate is OFF and everything is open — that is
 * how the password is currently disabled (owner's call, 2026-09-03, pending a
 * different access system later). Setting ADMIN_PASSWORD in the environment
 * turns the gate back on instantly; no code change needed.
 */
export async function isAuthed(): Promise<boolean> {
  if (!authConfigured()) return true;
  const jar = await cookies();
  return tokenValid(jar.get(COOKIE)?.value);
}

export const SESSION_COOKIE = COOKIE;
export const SESSION_MAX_AGE = MAX_AGE;
