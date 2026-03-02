import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { createRequestId } from "@/lib/request-id";

export const runtime = "nodejs";

const schema = z.object({
  requestId: z.string().uuid(),
  playlistId: z.string().min(4).max(128),
  rating: z.union([z.literal(1), z.literal(-1)]),
  notes: z.string().max(300).optional()
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "bad_request", message: "Invalid feedback payload." } },
      { status: 400 }
    );
  }

  const userId = await getSessionUserId();
  const db = getDb();
  db.prepare(
    `INSERT INTO feedback (id, user_id, vibe_request_id, playlist_id, rating, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    createRequestId(),
    userId,
    parsed.data.requestId,
    parsed.data.playlistId,
    parsed.data.rating,
    parsed.data.notes ?? null,
    new Date().toISOString()
  );

  return NextResponse.json({ ok: true });
}
