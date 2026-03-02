import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { buildSearchQueries, buildVibeProfile, promptHash } from "@/lib/vibe";
import { rankAndDiversify } from "@/lib/rank";
import { SpotifyApiError, spotifySearchPlaylists } from "@/lib/spotify";
import { checkRateLimit } from "@/lib/rate-limit";
import { createRequestId } from "@/lib/request-id";
import { getDb } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { getRecommendationCache, setRecommendationCache } from "@/lib/cache";
import { logError, logInfo } from "@/lib/logger";

export const runtime = "nodejs";

const schema = z.object({
  prompt: z.string().trim().min(3).max(800),
  limit: z.number().int().min(1).max(24).default(12)
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const ip = request.headers.get("x-forwarded-for") ?? "local";
  const rate = checkRateLimit(`rec:${ip}`);

  if (!rate.allowed) {
    return NextResponse.json(
      {
        error: {
          code: "rate_limited",
          message: "Too many requests. Please retry in a moment.",
          retryAfterSec: rate.retryAfterSec
        }
      },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "bad_request", message: "Invalid prompt or limit." } },
      { status: 400 }
    );
  }

  const { prompt, limit } = parsed.data;
  const reqId = createRequestId();
  const hash = promptHash(prompt);
  const userId = await getSessionUserId();
  const cacheKey = `${hash}:${limit}`;

  const cached = getRecommendationCache(cacheKey);
  if (cached) {
    return NextResponse.json({
      viewer: { isAuthed: Boolean(userId) },
      meta: { requestId: cached.requestId, note: "search-only mode (cache hit)" },
      vibe: cached.vibe,
      results: cached.results
    });
  }

  try {
    const vibe = buildVibeProfile(prompt);
    const queries = buildSearchQueries(vibe).slice(0, 4);

    const candidates = [];
    for (const query of queries) {
      for (const offset of [0, 10]) {
        const found = await spotifySearchPlaylists(query, offset);
        candidates.push(...found);
        const dedupedSoFar = new Set(candidates.map((candidate) => candidate.playlistId));
        if (dedupedSoFar.size >= Math.max(30, limit * 3)) {
          break;
        }
      }

      const dedupedSoFar = new Set(candidates.map((candidate) => candidate.playlistId));
      if (dedupedSoFar.size < Math.max(12, limit * 2)) {
        const found = await spotifySearchPlaylists(query, 20);
        candidates.push(...found);
      }

      const enoughCandidates = new Set(candidates.map((candidate) => candidate.playlistId)).size;
      if (enoughCandidates >= Math.max(30, limit * 3)) {
        break;
      }
    }

    const deduped = Array.from(new Map(candidates.map((x) => [x.playlistId, x])).values());
    const ranked = rankAndDiversify(vibe, deduped, limit);

    const db = getDb();
    db.prepare(
      `INSERT INTO vibe_requests (id, user_id, prompt, prompt_hash, vibe_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(reqId, userId, prompt, hash, JSON.stringify(vibe), new Date().toISOString());

    const insert = db.prepare(
      `INSERT INTO playlist_results (id, vibe_request_id, playlist_id, playlist_name, playlist_url, image_url, owner_name, score, reasons_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    for (const row of ranked) {
      insert.run(
        createRequestId(),
        reqId,
        row.playlistId,
        row.playlistName,
        row.playlistUrl,
        row.imageUrl ?? null,
        row.ownerName,
        row.score,
        JSON.stringify(row.reasons),
        new Date().toISOString()
      );
    }

    setRecommendationCache(cacheKey, { vibe, results: ranked, requestId: reqId });

    logInfo("recommendations.complete", {
      requestId: reqId,
      userId,
      resultCount: ranked.length,
      cacheHit: false
    });

    return NextResponse.json({
      viewer: { isAuthed: Boolean(userId) },
      meta: { requestId: reqId, note: "search-only mode" },
      vibe,
      results: ranked
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logError("recommendations.failed", {
      requestId: reqId,
      error: message
    });
    if (error instanceof SpotifyApiError && error.status === 429) {
      return NextResponse.json(
        {
          error: {
            code: "rate_limited",
            message: "Spotify rate limit reached. Please retry shortly.",
            retryAfterSec: error.retryAfterSec ?? 10
          }
        },
        { status: 429 }
      );
    }
    return NextResponse.json(
      {
        error: {
          code: "spotify_error",
          message: `Spotify search failed. ${message}`
        }
      },
      { status: 502 }
    );
  }
}
