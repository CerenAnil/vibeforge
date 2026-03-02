import type { PlaylistCandidate, RankedPlaylist, VibeProfile } from "@/lib/types";

function textTokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((x) => x.length > 1)
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  const union = new Set([...a, ...b]);
  if (union.size === 0) {
    return 0;
  }
  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) {
      intersection += 1;
    }
  }
  return intersection / union.size;
}

function reasonsFor(
  vibe: VibeProfile,
  item: PlaylistCandidate,
  keywordHits: string[],
  moodHits: string[],
  genreHits: string[],
  excludedHits: string[]
): string[] {
  const reasons: string[] = [];

  if (keywordHits.length > 0) {
    reasons.push(`keyword match: ${keywordHits.slice(0, 3).join(", ")}`);
  }
  if (genreHits.length > 0) {
    reasons.push(`genre hint: ${genreHits.slice(0, 2).join(" / ")}`);
  }
  if (moodHits.length > 0) {
    reasons.push(`mood hint: ${moodHits.slice(0, 2).join(" / ")}`);
  }
  if (vibe.contexts.length > 0) {
    reasons.push(`context hint: ${vibe.contexts.slice(0, 2).join(" / ")}`);
  }
  if (vibe.bpmMin || vibe.bpmMax) {
    reasons.push(
      `BPM range requested: ${vibe.bpmMin ?? "?"}-${vibe.bpmMax ?? "?"} (approximation)`
    );
  }
  if (excludedHits.length > 0) {
    reasons.push(`penalized excluded terms: ${excludedHits.slice(0, 2).join(", ")}`);
  }
  const combined = `${item.playlistName} ${item.description}`.trim();
  if (combined.length > 15) {
    reasons.push("high text match on title/description");
  }

  return reasons.slice(0, 5);
}

function similarity(a: PlaylistCandidate, b: PlaylistCandidate): number {
  const ta = textTokens(`${a.playlistName} ${a.description}`);
  const tb = textTokens(`${b.playlistName} ${b.description}`);
  return jaccard(ta, tb);
}

export function rankAndDiversify(
  vibe: VibeProfile,
  candidates: PlaylistCandidate[],
  limit: number
): RankedPlaylist[] {
  const vibeTokens = new Set(vibe.keywords);

  const scored: RankedPlaylist[] = candidates.map((item) => {
    const sourceText = `${item.playlistName} ${item.description} ${item.ownerName}`.toLowerCase();
    const itemTokens = textTokens(sourceText);
    const lexical = jaccard(vibeTokens, itemTokens);

    const keywordHits = vibe.keywords.filter((k) => sourceText.includes(k));
    const moodHits = vibe.moods.filter((m) => sourceText.includes(m));
    const genreHits = vibe.genres.filter((g) => sourceText.includes(g));
    const phraseHits = vibe.phrases.filter((p) => sourceText.includes(p));
    const excludedHits = vibe.excludeKeywords.filter((x) => sourceText.includes(x));

    let score = lexical * 0.65;
    score += Math.min(0.2, keywordHits.length * 0.03);
    score += Math.min(0.12, moodHits.length * 0.03);
    score += Math.min(0.12, genreHits.length * 0.04);
    score += Math.min(0.1, phraseHits.length * 0.05);
    score -= Math.min(0.24, excludedHits.length * 0.08);

    if (item.description.trim().length < 8) {
      score -= 0.04;
    }

    return {
      ...item,
      score,
      reasons: reasonsFor(vibe, item, keywordHits, moodHits, genreHits, excludedHits)
    };
  });

  scored.sort((a, b) => b.score - a.score);

  const reranked: RankedPlaylist[] = [];
  const pool = [...scored];
  const lambda = 0.75;

  while (pool.length > 0 && reranked.length < limit) {
    let bestIndex = 0;
    let bestScore = -Infinity;

    for (let i = 0; i < pool.length; i += 1) {
      const candidate = pool[i];
      const diversityPenalty = reranked.length
        ? Math.max(...reranked.map((picked) => similarity(candidate, picked)))
        : 0;
      const mmr = lambda * candidate.score - (1 - lambda) * diversityPenalty;
      if (mmr > bestScore) {
        bestScore = mmr;
        bestIndex = i;
      }
    }

    reranked.push(pool[bestIndex]);
    pool.splice(bestIndex, 1);
  }

  return reranked;
}
