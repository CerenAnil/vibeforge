import { LRUCache } from "lru-cache";
import type { RankedPlaylist, VibeProfile } from "@/lib/types";

type RecommendationCacheEntry = {
  vibe: VibeProfile;
  results: RankedPlaylist[];
  requestId: string;
};

const recommendationCache = new LRUCache<string, RecommendationCacheEntry>({
  max: 200,
  ttl: 1000 * 60 * 10
});

export function getRecommendationCache(key: string): RecommendationCacheEntry | undefined {
  return recommendationCache.get(key);
}

export function setRecommendationCache(key: string, value: RecommendationCacheEntry): void {
  recommendationCache.set(key, value);
}

const spotifyTokenCache = new LRUCache<string, { token: string }>({
  max: 1,
  ttl: 1000 * 60 * 50
});

export function getAppToken(): string | undefined {
  return spotifyTokenCache.get("app")?.token;
}

export function setAppToken(token: string, expiresInSec: number): void {
  spotifyTokenCache.set("app", { token }, { ttl: Math.max(5, expiresInSec - 30) * 1000 });
}
