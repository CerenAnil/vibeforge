import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { createRequestId } from "@/lib/request-id";
import { exchangeAuthCode, fetchMe } from "@/lib/spotify";
import { createSession } from "@/lib/session";
import { getDb } from "@/lib/db";
import { encryptJson } from "@/lib/crypto";
import { logError } from "@/lib/logger";
import { takePkceVerifier } from "@/lib/pkce-store";

export const runtime = "nodejs";

const schema = z.object({
  code: z.string().min(8),
  state: z.string().optional()
});

function consumePostAuthRedirect(cookieStore: Awaited<ReturnType<typeof cookies>>): string {
  const redirect = cookieStore.get("vf_post_auth_redirect")?.value;
  cookieStore.delete("vf_post_auth_redirect");
  if (!redirect || !redirect.startsWith("/") || redirect.startsWith("//")) {
    return "/";
  }
  return redirect;
}

async function finalizeAuth(code: string, state?: string): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const cookieStore = await cookies();
  let verifier = cookieStore.get("vf_pkce_verifier")?.value;
  const expectedState = cookieStore.get("vf_auth_state")?.value;

  if (expectedState && state && expectedState !== state) {
    return { ok: false, status: 401, message: "OAuth state mismatch." };
  }
  if (!verifier && state) {
    verifier = takePkceVerifier(state) ?? undefined;
  }
  if (!verifier) {
    return {
      ok: false,
      status: 400,
      message: "Missing PKCE verifier cookie. Ensure login and callback use the same host (localhost vs 127.0.0.1)."
    };
  }

  let tokens;
  let me;
  try {
    tokens = await exchangeAuthCode(code, verifier);
    me = await fetchMe(tokens.access_token);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logError("auth.callback.exchange_failed", { message });
    return { ok: false, status: 502, message: `Spotify token exchange failed. ${message}` };
  }

  if (!tokens.refresh_token) {
    return { ok: false, status: 502, message: "No refresh token returned from Spotify." };
  }

  const db = getDb();
  const existing = db
    .prepare(`SELECT id FROM users WHERE spotify_user_id = ?`)
    .get(me.id) as { id: string } | undefined;

  const userId = existing?.id ?? createRequestId();
  const now = new Date().toISOString();
  const imageUrl = me.images?.[0]?.url ?? null;
  const tokenBlob = encryptJson({ refreshToken: tokens.refresh_token });

  if (existing) {
    db.prepare(
      `UPDATE users SET display_name = ?, email = ?, image_url = ?, token_enc_blob = ?, updated_at = ? WHERE id = ?`
    ).run(me.display_name ?? null, me.email ?? null, imageUrl, tokenBlob, now, userId);
  } else {
    db.prepare(
      `INSERT INTO users (id, spotify_user_id, display_name, email, image_url, token_enc_blob, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(userId, me.id, me.display_name ?? null, me.email ?? null, imageUrl, tokenBlob, now, now);
  }

  await createSession(userId);
  cookieStore.delete("vf_pkce_verifier");
  cookieStore.delete("vf_auth_state");
  return { ok: true };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const incoming = new URL(request.url);
  const code = incoming.searchParams.get("code");
  const state = incoming.searchParams.get("state") ?? undefined;
  const oauthError = incoming.searchParams.get("error");
  const oauthDescription = incoming.searchParams.get("error_description");

  if (oauthError) {
    const redirect = new URL("/auth/callback", incoming.origin);
    redirect.searchParams.set("error", oauthError);
    if (oauthDescription) {
      redirect.searchParams.set("error_description", oauthDescription);
    }
    return NextResponse.redirect(redirect);
  }

  if (!code) {
    const redirect = new URL("/auth/callback", incoming.origin);
    redirect.searchParams.set("error", "missing_code");
    return NextResponse.redirect(redirect);
  }

  const result = await finalizeAuth(code, state);
  if (result.ok) {
    const cookieStore = await cookies();
    const redirectPath = consumePostAuthRedirect(cookieStore);
    return NextResponse.redirect(new URL(redirectPath, incoming.origin));
  }

  const redirect = new URL("/auth/callback", incoming.origin);
  redirect.searchParams.set("error", "token_exchange_failed");
  redirect.searchParams.set("error_description", result.message.slice(0, 400));
  return NextResponse.redirect(redirect);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "bad_request", message: "Invalid callback payload." } },
      { status: 400 }
    );
  }

  const result = await finalizeAuth(parsed.data.code, parsed.data.state);
  if (result.ok) {
    const cookieStore = await cookies();
    const redirectTo = consumePostAuthRedirect(cookieStore);
    return NextResponse.json({ ok: true, redirectTo });
  }
  return NextResponse.json(
    {
      error: {
        code: result.status === 401 ? "unauthorized" : "spotify_error",
        message: result.message
      }
    },
    { status: result.status }
  );
}
