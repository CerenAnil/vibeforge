import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ isAuthed: false });
  }

  const row = getDb()
    .prepare(`SELECT display_name, image_url FROM users WHERE id = ?`)
    .get(userId) as { display_name: string | null; image_url: string | null } | undefined;

  return NextResponse.json({
    isAuthed: true,
    displayName: row?.display_name ?? null,
    imageUrl: row?.image_url ?? null
  });
}
