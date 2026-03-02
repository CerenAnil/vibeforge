import { createHash } from "node:crypto";
import type { VibeProfile } from "@/lib/types";

const stopwords = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "for",
  "with",
  "to",
  "of",
  "in",
  "on",
  "at",
  "is",
  "it",
  "this",
  "that",
  "be",
  "want",
  "towards",
  "doing"
]);

const genreMap: Record<string, string> = {
  synthwave: "synthwave",
  retrowave: "synthwave",
  outrun: "synthwave",
  cyberpunk: "electronic",
  jazz: "jazz",
  lofi: "lo-fi",
  lofihiphop: "lo-fi",
  ambient: "ambient",
  house: "house",
  techno: "techno",
  rock: "rock",
  indie: "indie",
  metal: "metal",
  pop: "pop",
  hiphop: "hip-hop",
  rap: "hip-hop",
  edm: "electronic",
  trance: "electronic",
  dubstep: "electronic",
  dnb: "electronic",
  drumandbass: "electronic",
  phonk: "electronic",
  electronic: "electronic",
  electronica: "electronic",
  chillhop: "lo-fi",
  chillout: "ambient",
  orchestral: "classical",
  classical: "classical",
  piano: "classical",
  soundtrack: "cinematic",
  cinematic: "cinematic",
  score: "cinematic",
  folk: "folk",
  acoustic: "acoustic",
  punk: "punk",
  punkrock: "punk",
  soul: "soul",
  funk: "funk",
  disco: "disco",
  rnb: "rnb",
  randb: "rnb",
  blues: "blues",
  latin: "latin",
  reggaeton: "latin",
  afrobeat: "afrobeat",
  kpop: "k-pop",
  jpop: "j-pop",
  workout: "fitness",
  sport: "fitness",
  sports: "fitness",
  running: "fitness",
  cardio: "fitness"
};

const moodMap: Record<string, string> = {
  moody: "moody",
  hopeful: "hopeful",
  dark: "dark",
  happy: "happy",
  sad: "sad",
  energetic: "energetic",
  calm: "calm",
  mellow: "mellow",
  smoky: "smoky",
  airy: "airy",
  driving: "driving",
  aggressive: "aggressive",
  dreamy: "dreamy",
  motivation: "motivating",
  motivating: "motivating",
  focus: "focused",
  focused: "focused",
  productivity: "focused",
  hype: "energetic",
  uplifting: "uplifting",
  intense: "energetic",
  gym: "energetic",
  sports: "energetic",
  workout: "energetic",
  boost: "energetic",
  boosting: "energetic",
  euphoric: "euphoric",
  angry: "aggressive",
  melancholic: "melancholic",
  emotional: "emotional",
  chill: "calm",
  chilled: "calm",
  relaxing: "calm",
  relaxed: "calm",
  meditative: "calm",
  romantic: "romantic",
  sexy: "romantic",
  party: "party",
  celebratory: "party"
};

const moodTargets: Record<string, Partial<VibeProfile["targets"]>> = {
  energetic: { energy: 0.85, danceability: 0.75 },
  calm: { energy: 0.25, acousticness: 0.6 },
  dark: { valence: 0.2 },
  hopeful: { valence: 0.7 },
  moody: { valence: 0.35 },
  dreamy: { energy: 0.4, acousticness: 0.45 },
  driving: { energy: 0.78 },
  motivating: { energy: 0.82, valence: 0.72, danceability: 0.72 },
  uplifting: { valence: 0.78, energy: 0.72 },
  focused: { energy: 0.5, danceability: 0.48, acousticness: 0.35 },
  euphoric: { energy: 0.88, valence: 0.84, danceability: 0.76 },
  aggressive: { energy: 0.92, valence: 0.28 },
  melancholic: { valence: 0.22, acousticness: 0.42 },
  emotional: { valence: 0.4, energy: 0.45 },
  romantic: { valence: 0.68, energy: 0.4 },
  party: { energy: 0.86, danceability: 0.82 }
};

const genreAliases: Record<string, string[]> = {
  "drum and bass": ["electronic"],
  "drum & bass": ["electronic"],
  "lo fi": ["lo-fi"],
  "lo-fi": ["lo-fi"],
  "hip hop": ["hip-hop"],
  "alt rock": ["rock", "indie"],
  "indie pop": ["indie", "pop"],
  "indie rock": ["indie", "rock"],
  "movie score": ["cinematic", "classical"],
  "film score": ["cinematic", "classical"],
  "video game": ["electronic"],
  "video game soundtrack": ["cinematic", "electronic"]
};

const moodAliases: Record<string, string[]> = {
  "feel good": ["uplifting", "hopeful"],
  "high energy": ["energetic", "motivating"],
  "locked in": ["focused"],
  "late night": ["moody"],
  "night drive": ["driving", "energetic"],
  "heartbreak": ["melancholic", "emotional"],
  "pump up": ["motivating", "energetic"],
  "cool down": ["calm", "mellow"],
  "rainy day": ["moody", "melancholic"]
};

const contextAliases: Record<string, string[]> = {
  workout: ["workout", "gym", "sports", "sport", "exercise", "running", "run", "cardio", "lifting"],
  focus: ["focus", "study", "studying", "coding", "work", "deep focus", "concentration", "reading"],
  driving: ["drive", "driving", "road trip", "night drive", "commute"],
  "late-night": ["late night", "after hours", "midnight"],
  "coffee-shop": ["coffee shop", "cafe", "espresso", "coffeehouse"],
  party: ["party", "club", "pre-game", "pregame", "celebration"],
  romance: ["date night", "romantic", "candlelit", "love"],
  "morning-energy": ["morning", "wake up", "sunrise"],
  "sleep-wind-down": ["sleep", "sleepy", "wind down", "bedtime"]
};

const contextSearchTerms: Record<string, string[]> = {
  workout: ["workout", "gym", "training", "cardio"],
  focus: ["focus", "study", "concentration", "instrumental"],
  driving: ["driving", "road trip", "night drive", "cruise"],
  "late-night": ["late night", "midnight", "after hours"],
  "coffee-shop": ["coffee shop", "cafe", "indie acoustic"],
  party: ["party", "club", "dance"],
  romance: ["romantic", "date night", "soft vibes"],
  "morning-energy": ["morning", "wake up", "sunrise"],
  "sleep-wind-down": ["sleep", "wind down", "calm"]
};

const genreSearchTerms: Record<string, string[]> = {
  electronic: ["electronic", "edm", "dance"],
  "lo-fi": ["lo-fi", "chillhop", "beats"],
  "hip-hop": ["hip-hop", "rap"],
  cinematic: ["cinematic", "soundtrack", "score"],
  fitness: ["workout", "fitness", "gym"],
  indie: ["indie", "alt"],
  acoustic: ["acoustic", "stripped"],
  classical: ["classical", "piano", "orchestral"]
};

const moodSearchTerms: Record<string, string[]> = {
  motivating: ["motivating", "hype", "push"],
  energetic: ["energetic", "high energy", "power"],
  focused: ["focus", "deep focus", "flow"],
  uplifting: ["uplifting", "feel good", "positive"],
  moody: ["moody", "atmospheric"],
  calm: ["calm", "relaxing", "chill"],
  melancholic: ["melancholic", "sad", "heartbreak"],
  driving: ["driving", "cruise", "night drive"]
};

const languageAliases: Record<string, string[]> = {
  turkish: ["turkish"],
  turkce: ["turkish"],
  turkcepop: ["turkish"],
  english: ["english"],
  ukenglish: ["english"],
  british: ["english"],
  spanish: ["spanish"],
  espanol: ["spanish"],
  latinspanish: ["spanish"],
  french: ["french"],
  francais: ["french"],
  german: ["german"],
  deutsch: ["german"],
  italian: ["italian"],
  korean: ["korean"],
  japanese: ["japanese"],
  arabic: ["arabic"],
  hindi: ["hindi"],
  punjabi: ["punjabi"]
};

const regionAliases: Record<string, string[]> = {
  uk: ["uk"],
  british: ["uk"],
  england: ["uk"],
  london: ["uk"],
  us: ["us"],
  usa: ["us"],
  american: ["us"],
  turkey: ["turkey"],
  turkish: ["turkey"],
  latin: ["latin-america"],
  spanish: ["latin-america"],
  france: ["france"],
  french: ["france"],
  germany: ["germany"],
  german: ["germany"],
  italy: ["italy"],
  korean: ["korea"],
  japan: ["japan"],
  arabic: ["middle-east"],
  india: ["india"],
  punjabi: ["india"]
};

const languageSearchTerms: Record<string, string[]> = {
  turkish: ["turkish", "turkce"],
  english: ["english", "international"],
  spanish: ["spanish", "espanol"],
  french: ["french", "francais"],
  german: ["german", "deutsch"],
  italian: ["italian"],
  korean: ["korean", "k-pop"],
  japanese: ["japanese", "j-pop"],
  arabic: ["arabic"],
  hindi: ["hindi", "bollywood"],
  punjabi: ["punjabi"]
};

const regionSearchTerms: Record<string, string[]> = {
  uk: ["uk", "british", "london"],
  us: ["us", "american"],
  turkey: ["turkish", "turkey"],
  "latin-america": ["latin", "latino"],
  france: ["french", "france"],
  germany: ["german", "deutsch"],
  italy: ["italian"],
  korea: ["korean", "seoul"],
  japan: ["japanese", "tokyo"],
  "middle-east": ["arabic", "middle east"],
  india: ["indian", "desi", "india"]
};

function normalizeToken(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function tokenize(prompt: string): string[] {
  return prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map(normalizeToken)
    .filter((t) => t.length > 1 && !stopwords.has(t));
}

function toPhrase(tokens: string[]): string {
  return tokens.join(" ");
}

const phraseGenres: Record<string, string[]> = {
  "gym motivation": ["fitness"],
  "workout motivation": ["fitness"],
  "night drive": ["electronic"],
  "coffee shop": ["indie", "acoustic"],
  "road trip": ["rock", "indie"],
  "deep focus": ["lo-fi", "ambient"],
  "study focus": ["lo-fi", "ambient"],
  "sunrise run": ["fitness", "electronic"],
  "after hours": ["electronic", "rnb"]
};

const phraseMoods: Record<string, string[]> = {
  "late night": ["moody"],
  "night drive": ["driving", "energetic"],
  "gym motivation": ["motivating", "energetic"],
  "workout motivation": ["motivating", "energetic"],
  "high energy": ["energetic"],
  "feel good": ["uplifting", "hopeful"],
  "study focus": ["focused", "calm"],
  "deep focus": ["focused", "calm"],
  "coffee shop": ["calm", "mellow"],
  "sunrise run": ["uplifting", "motivating"],
  "after hours": ["moody", "driving"]
};

function extractPhrases(prompt: string): string[] {
  const tokens = tokenize(prompt);
  const phrases = new Set<string>();
  const lower = prompt.toLowerCase();

  for (let size = 2; size <= 3; size += 1) {
    for (let i = 0; i <= tokens.length - size; i += 1) {
      const phrase = toPhrase(tokens.slice(i, i + size));
      if (phrase.length >= 6) {
        phrases.add(phrase);
      }
    }
  }

  for (const phrase of [
    ...Object.keys(genreAliases),
    ...Object.keys(moodAliases),
    ...Object.keys(phraseGenres),
    ...Object.keys(phraseMoods),
    ...Object.values(contextAliases).flat()
  ]) {
    if (lower.includes(phrase)) {
      phrases.add(phrase);
    }
  }

  return [...phrases];
}

function extractExcludeKeywords(prompt: string): string[] {
  const lower = prompt.toLowerCase();
  const excludes = new Set<string>();

  const regex = /\b(?:no|without|exclude|excluding|avoid|not)\s+([a-z0-9-]+)/g;
  let match = regex.exec(lower);
  while (match) {
    const token = normalizeToken(match[1]);
    if (token.length > 1) {
      excludes.add(token);
    }
    match = regex.exec(lower);
  }
  return [...excludes];
}

function inferContexts(tokens: string[], phrases: string[]): string[] {
  const contexts = new Set<string>();
  const joined = new Set([...tokens, ...phrases]);
  for (const [context, aliases] of Object.entries(contextAliases)) {
    if (aliases.some((alias) => joined.has(alias) || phrases.some((phrase) => phrase.includes(alias)))) {
      contexts.add(context);
    }
  }
  return [...contexts];
}

function expandCanonicalTerms(
  canonical: string[],
  lookup: Record<string, string[]>,
  limit: number
): string[] {
  const values = new Set<string>();
  for (const item of canonical) {
    values.add(item);
    for (const expanded of lookup[item] ?? []) {
      values.add(expanded);
    }
  }
  return [...values].slice(0, limit);
}

function extractClassifications(
  tokens: string[],
  phrases: string[],
  aliases: Record<string, string[]>
): string[] {
  const found = new Set<string>();
  const joined = new Set([...tokens, ...phrases]);

  for (const item of joined) {
    for (const canonical of aliases[item] ?? []) {
      found.add(canonical);
    }
  }

  for (const phrase of phrases) {
    for (const [alias, canonicals] of Object.entries(aliases)) {
      if (phrase.includes(alias)) {
        for (const canonical of canonicals) {
          found.add(canonical);
        }
      }
    }
  }

  return [...found];
}

export function parseBpm(prompt: string): { min?: number; max?: number } {
  const range = prompt.match(/(\d{2,3})\s*(?:-|–|to)\s*(\d{2,3})(?:\s*bpm)?/i);
  if (range) {
    const a = Number(range[1]);
    const b = Number(range[2]);
    const min = Math.max(40, Math.min(a, b));
    const max = Math.min(220, Math.max(a, b));
    return { min, max };
  }
  const around = prompt.match(/(?:around|about|approx(?:imately)?|~)\s*(\d{2,3})(?:\s*bpm)?/i);
  if (around) {
    const bpm = Number(around[1]);
    return { min: Math.max(40, bpm - 10), max: Math.min(220, bpm + 10) };
  }
  const single = prompt.match(/(\d{2,3})\s*bpm/i);
  if (single) {
    const bpm = Number(single[1]);
    return { min: Math.max(40, bpm - 8), max: Math.min(220, bpm + 8) };
  }
  if (/\bslow\b/i.test(prompt)) {
    return { min: 70, max: 105 };
  }
  if (/\bfast\b/i.test(prompt)) {
    return { min: 130, max: 175 };
  }
  return {};
}

export function buildVibeProfile(prompt: string): VibeProfile {
  const tokens = tokenize(prompt);
  const phrases = extractPhrases(prompt);
  const excludeKeywords = extractExcludeKeywords(prompt);
  const contexts = inferContexts(tokens, phrases);
  const languages = extractClassifications(tokens, phrases, languageAliases);
  const regions = extractClassifications(tokens, phrases, regionAliases);
  const keywords = [...new Set(tokens.filter((t) => !excludeKeywords.includes(t)))].slice(0, 28);

  const genres = new Set<string>();
  const moods = new Set<string>();
  for (const keyword of keywords) {
    const genre = genreMap[keyword];
    const mood = moodMap[keyword];
    if (genre) {
      genres.add(genre);
    }
    if (mood) {
      moods.add(mood);
    }
  }
  for (const phrase of phrases) {
    for (const genre of genreAliases[phrase] ?? []) {
      genres.add(genre);
    }
    for (const mood of moodAliases[phrase] ?? []) {
      moods.add(mood);
    }
    for (const genre of phraseGenres[phrase] ?? []) {
      genres.add(genre);
    }
    for (const mood of phraseMoods[phrase] ?? []) {
      moods.add(mood);
    }
  }

  const bpm = parseBpm(prompt);
  const targets: VibeProfile["targets"] = {};
  for (const mood of moods) {
    Object.assign(targets, moodTargets[mood]);
  }

  return {
    keywords,
    phrases,
    contexts,
    excludeKeywords,
    languages,
    regions,
    genres: [...genres],
    moods: [...moods],
    bpmMin: bpm.min,
    bpmMax: bpm.max,
    targets
  };
}

export function promptHash(prompt: string): string {
  return createHash("sha256").update(prompt.trim().toLowerCase()).digest("hex");
}

export function buildSearchQueries(vibe: VibeProfile): string[] {
  const genres = expandCanonicalTerms(vibe.genres.slice(0, 3), genreSearchTerms, 6);
  const moods = expandCanonicalTerms(vibe.moods.slice(0, 3), moodSearchTerms, 6);
  const languages = expandCanonicalTerms(vibe.languages.slice(0, 2), languageSearchTerms, 4);
  const regions = expandCanonicalTerms(vibe.regions.slice(0, 2), regionSearchTerms, 4);
  const keywords = vibe.keywords.slice(0, 8);
  const contexts = expandCanonicalTerms(vibe.contexts.slice(0, 2), contextSearchTerms, 5);
  const phrases = vibe.phrases
    .filter((phrase) => !vibe.excludeKeywords.some((exclude) => phrase.includes(exclude)))
    .slice(0, 4);
  const excludes = vibe.excludeKeywords.slice(0, 3).map((x) => `-${x}`);

  const q1 = [
    ...contexts.slice(0, 3),
    ...moods.slice(0, 2),
    ...genres.slice(0, 2),
    ...languages.slice(0, 2),
    ...excludes
  ].join(" ");
  const q2 = [
    ...phrases.slice(0, 2),
    ...genres.slice(0, 2),
    ...regions.slice(0, 2),
    "playlist",
    ...excludes
  ].join(" ");
  const q3 = [
    ...keywords.slice(0, 4),
    ...moods.slice(0, 2),
    ...languages.slice(0, 2),
    "mix",
    ...excludes
  ].join(" ");
  const q4 = [
    ...genres.slice(0, 3),
    ...regions.slice(0, 2),
    ...keywords.slice(0, 2),
    ...contexts.slice(0, 2),
    ...excludes
  ].join(" ");
  const q5 = [
    ...phrases.slice(2, 4),
    ...keywords.slice(0, 3),
    ...languages.slice(0, 1),
    "vibes",
    ...excludes
  ].join(" ");
  const q6 = [...regions.slice(0, 2), ...languages.slice(0, 2), ...genres.slice(0, 2), ...excludes].join(
    " "
  );

  return [...new Set([q1, q2, q3, q4, q5, q6].map((q) => q.trim()).filter((q) => q.length > 0))];
}
