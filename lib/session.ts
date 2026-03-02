import { cookies } from "next/headers";
import { createHash, randomUUID } from "node:crypto";
import { env } from "@/lib/env";
import { getDb } from "@/lib/db";

const SESSION_COOKIE = "vf_session";

function nowIso(): string {
  return new Date().toISOString();
}

function futureIso(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function signId(id: string): string {
  return createHash("sha256").update(`${id}.${env.SESSION_SECRET}`).digest("hex");
}

function encodeCookie(id: string): string {
  return `${id}.${signId(id)}`;
}

function decodeCookie(value: string): string | null {
  const [id, sig] = value.split(".");
  if (!id || !sig) {
    return null;
  }
  return signId(id) === sig ? id : null;
}

export async function createSession(userId: string): Promise<void> {
  const db = getDb();
  const id = randomUUID();
  const expires = futureIso(14);
  db.prepare(
    `INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)`
  ).run(id, userId, expires, nowIso());

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, encodeCookie(id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14
  });
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  if (raw) {
    const id = decodeCookie(raw);
    if (id) {
      getDb().prepare(`DELETE FROM sessions WHERE id = ?`).run(id);
    }
  }
  cookieStore.delete(SESSION_COOKIE);
}

export async function getSessionUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  if (!raw) {
    return null;
  }

  const sessionId = decodeCookie(raw);
  if (!sessionId) {
    return null;
  }

  const row = getDb()
    .prepare(`SELECT user_id, expires_at FROM sessions WHERE id = ?`)
    .get(sessionId) as { user_id: string; expires_at: string } | undefined;

  if (!row || row.expires_at < nowIso()) {
    return null;
  }

  return row.user_id;
}
