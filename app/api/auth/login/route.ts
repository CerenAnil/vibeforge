import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { buildAuthUrl } from "@/lib/spotify";
import { createCodeChallenge, createCodeVerifier } from "@/lib/pkce";
import { putPkceVerifier } from "@/lib/pkce-store";

export const runtime = "nodejs";

const schema = z.object({
  next: z.string().optional()
});

function normalizeRedirectTarget(value?: string): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }
  return value;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const verifier = createCodeVerifier();
  const challenge = createCodeChallenge(verifier);
  const state = randomUUID();
  putPkceVerifier(state, verifier);
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  const nextPath = normalizeRedirectTarget(parsed.success ? parsed.data.next : undefined);

  const cookieStore = await cookies();
  cookieStore.set("vf_pkce_verifier", verifier, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10
  });
  cookieStore.set("vf_auth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10
  });
  cookieStore.set("vf_post_auth_redirect", nextPath, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10
  });

  const authUrl = await buildAuthUrl(challenge, state);
  return NextResponse.json({ authUrl });
}
