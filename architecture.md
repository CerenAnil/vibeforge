# Vibeforge — Vibe → Playlist Recommendations (+ Spotify Playlist Generator)

## 1) Spotify platform constraints (design-critical)

This app is designed to function even when Spotify restricts endpoints for new/dev-mode apps:

* Since Nov 27, 2024, new Web API use cases (and many development-mode apps) **cannot use**: Related Artists, Recommendations, Audio Features, Audio Analysis, Featured Playlists, Category’s Playlists, 30-second preview URLs in some objects, and “algorithmic + Spotify-owned editorial playlists.”

* Feb 2026 changes include:

  * Playlist track management endpoints renamed from `/tracks` → `/items`.
  * Search `limit` max reduced to **10** (pagination via `offset`).
  * New app limits (notably **5 users per app** for new apps).
* Spotify policy notes in the Web API reference explicitly say Spotify content **may not be used to train ML/AI models or otherwise ingested into a machine learning/AI model**, and content may not be downloaded.

**Implication:** MVP must rely on **Search-based retrieval** and avoid any design that requires Recommendations/Audio Features. Embeddings (if used) must be applied to **user-provided text and our own taxonomy**, not Spotify content.

---

# A) Product spec

## One-sentence product

User types a vibe (“late-night neon cyberpunk drive, moody but hopeful, 110–130 BPM”) and the app returns ranked playlist recommendations, plus (when logged in) can generate a matching playlist in the user’s Spotify account.

## User stories (MVP)

1. As a guest, I enter a vibe and get **ranked playlists** fast.
2. As a guest, I see **2–5 reasons** per result (explainability).
3. As a logged-in Spotify user, I can **generate a new playlist** in my account matching the vibe.
4. As any user, I can thumbs up/down recommendations to improve future ranking.

## Scope (MVP)

* Free-text vibe prompt (multi-sentence)
* Ranked playlists list (guest mode)
* Explainability reasons
* Login via OAuth Authorization Code + PKCE (web)
* Generate playlist in user account (least-privilege scopes)
* Caching, progressive loading, clear skeletons/errors
* Rate limiting + abuse controls, no secrets in client

## Non-goals (MVP)

* Guarantee BPM/key/mode for third-party playlists (often unavailable without restricted endpoints)
* “Audio similarity” analysis or anything requiring Audio Features/Analysis
* Training ML models on Spotify content (explicitly disallowed)

## Phased roadmap (MVP → v1)

* **MVP (weekend):** Search-based playlist recs + ranking + reasons; login + playlist creation via search-based track sampling; feedback logging.
* **v1:** Personalization (bias ranking using user library/top items heuristics), richer UX (remix controls), shareable vibe pages, better caching & metrics.
* **v1.5:** Optional additional providers or deeper personalization if Spotify access constraints block product goals in production.

---

# B) UX flow + key screens (wireframe descriptions)

## Screen 1: Home (Vibe input)

* Large textarea (“Describe your vibe…”) + examples
* Optional chips: “Chill / Energetic / Acoustic / Dark / Driving”
* Optional controls (collapsed): BPM min/max, “Prefer niche”, playlist length
* CTA: “Get recommendations”
* Secondary: “Log in with Spotify” (explains it enables playlist creation)

## Screen 2: Results

* Editable prompt bar + “Run” button
* Skeleton cards immediately; results stream in as soon as first ranking completes
* Each playlist card:

  * cover art, name, owner, “Open in Spotify”
  * reasons (2–5 bullets)
  * thumbs up/down
* Sticky action: “Generate playlist” (disabled unless logged in)

## Screen 3: OAuth callback

* Success/failure message; auto-redirect back to results
* No tokens shown

## Screen 4: Generated playlist confirmation

* “Open playlist”
* “Regenerate” (v1) with small knobs: more energy / less energy, tighter BPM, more vocals, etc.

## Error states (explicit)

* Rate limit hit: show retry hint
* Spotify endpoint blocked: banner “Fallback mode (search-only)”
* Auth failure: show next action (“Retry login”, “Check redirect URI”)

---

# C) System design

## Architecture (text diagram)

Client (Next.js UI)
→ Backend (Next.js route handlers)
→ Spotify Accounts (OAuth PKCE token exchange)
→ Spotify Web API (Search; Create Playlist; Add Items)
→ DB (SQLite dev / Postgres prod)
→ Cache (in-memory LRU for prompt results + Spotify app token; Redis later)

## Data flow: Guest recommendations

1. Prompt submitted
2. Backend parses vibe → structured “VibeProfile”
3. Backend runs multiple Search queries (limit=10, paginated by offset)
4. Rank + diversify results; generate reasons
5. Store request/results for caching; return to client
6. Client renders quickly; optional enrichment pass (best-effort only)

## Data flow: Logged-in generate playlist

1. User auth via PKCE (no client secret in browser)
2. Backend stores refresh token encrypted-at-rest; session via HttpOnly cookie
3. Generate track list from vibe via Search-based track sampling (works even if Recommendations unavailable)
4. Create private playlist + add items using `/items` endpoint naming
5. Return playlist URL + note (mode used)

## Key tradeoffs

* Search-only ranking is reliable under Spotify restrictions; sonic accuracy is approximate.
* Diversity is essential because Search results can be repetitive.
* “Embeddings” help interpret user vibe text, but must not ingest Spotify content into an AI model.

---

# D) API design (endpoints + error handling + rate limiting)

## Common error schema

* `error.code` (string): `bad_request | unauthorized | rate_limited | spotify_error | not_found`
* `error.message` (string)
* Optional `error.retryAfterSec` (number) when 429 occurs

## Endpoints

### 1) POST `/api/vibe/recommendations`

Request fields:

* `prompt` (string, 3–800 chars)
* `limit` (int, default 12, max 24)

Response fields:

* `viewer.isAuthed` (boolean)
* `meta.requestId` (string)
* `meta.note` (string: “fallback mode”, cache info)
* `vibe` (VibeProfile)
* `results[]` each:

  * `playlistId`, `playlistName`, `playlistUrl`, `imageUrl`, `ownerName`
  * `score` (float)
  * `reasons[]` (2–5 short strings)

Rate limiting:

* Token bucket per IP (e.g., 20 requests burst, slow refill)
* Return 429 with retry hint

### 2) POST `/api/vibe/generate`

Auth required (session cookie)
Request fields:

* `requestId` (string)
* Optional `name` (string)
* Optional `length` (int: 25–100)

Response fields:

* `playlistId`, `playlistUrl`
* `generationMode` (“search-fallback”)
* `note` (short explanation)

### 3) POST `/api/feedback`

Request fields:

* `requestId` (string)
* `playlistId` (string)
* `rating` (+1 or -1)
* Optional `notes` (string)

Response:

* `ok: true`

### 4) GET `/api/me`

Response:

* `isAuthed` boolean
* Optional `displayName`, `imageUrl`

### 5) POST `/api/auth/callback`

Request fields:

* `code` (string)
* `codeVerifier` (string)

Response:

* `ok: true` (session established)

### 6) POST `/api/auth/logout`

Response:

* `ok: true`

---

# E) Data model (SQLite/Postgres)

## Tables

### `users`

* `id` (pk)
* `spotify_user_id` (unique)
* `display_name`, `email`, `image_url`
* `token_enc_blob` (encrypted refresh token bundle)
* `created_at`, `updated_at`

### `sessions`

* `id` (pk)
* `user_id` (fk)
* `expires_at`
* `created_at`

### `vibe_requests`

* `id` (pk)
* `user_id` (nullable; guest allowed)
* `prompt`
* `prompt_hash` (for caching)
* `vibe_json`
* `created_at`

### `playlist_results`

* `id` (pk)
* `vibe_request_id` (fk)
* `playlist_id`, `playlist_name`, `playlist_url`, `image_url`, `owner_name`
* `score`
* `reasons_json`
* `created_at`

### `feedback`

* `id` (pk)
* `user_id` (nullable)
* `vibe_request_id` (nullable)
* `playlist_id` (nullable)
* `generated_playlist_id` (nullable)
* `rating` (-1/+1)
* `notes`
* `created_at`

Indexes:

* `vibe_requests (prompt_hash, user_id, created_at desc)`
* `playlist_results (vibe_request_id, score desc)`
* `feedback (user_id, created_at)`

---

# F) Recommendation approach (robust vibe handling, no forbidden ML ingestion)

## 1) VibeProfile extraction (fast + deterministic)

From the user’s prompt:

* Keywords: normalized tokens (dedupe, stopwords removed)
* Genres: detected from a curated dictionary + synonym map (e.g., “synthwave/retrowave/outrun”)
* Moods: adjective map (moody, hopeful, aggressive, airy, smoky, etc.)
* BPM: parse patterns like “110–130 BPM”, “140 bpm”
* Audio-intent targets (heuristics): map mood words → approximate targets (energy/valence/danceability/acousticness)

## 2) Candidate generation (works in guest mode)

Spotify Search:

* Multiple queries derived from VibeProfile:

  * Query A: top genres + moods
  * Query B: top keywords + context words (“late night”, “coffee”, “noir”)
* Use pagination (`limit=10`, increasing `offset`) to build 30–80 candidates.

## 3) Ranking signals (safe + explainable)

For each playlist candidate, compute:

* Lexical similarity between vibe keywords and playlist name/description/owner text
* Constraint matches:

  * genre hits
  * mood hits
  * BPM mentioned in prompt → modest boost only if playlist text references tempo-like terms (don’t pretend it’s verified)
* Quality heuristics:

  * penalize “low info” playlists (empty description, overly generic title)

**No embeddings on Spotify content** (to avoid “ingesting Spotify content into an AI model”).
Embeddings (optional) are used only for:

* mapping the user vibe text onto our own internal “vibe taxonomy” (genre/mood phrases we author), improving robustness on weird phrasing.

## 4) Diversity constraint

Apply an MMR-like rerank:

* Keep top items relevant
* Penalize near-duplicates (high token overlap) so results aren’t 12 versions of “Synthwave Mix”

## 5) Explainability (2–5 reasons)

Reasons are directly generated from the signals:

* “keyword match: noir, smoky, late night”
* “genre hint: jazz / swing”
* “mood hint: moody / mellow”
* “BPM constraint present in prompt (110–130)”
* “high text match on title/description”

## 6) Fallback behavior

* If Spotify blocks certain playlist types (editorial/algorithmic), results will skew user-made; the UI labels “search-only mode.”
* If Search returns sparse results, expand query breadth (drop BPM, widen mood synonyms).

---

# G) Implementation plan (production-ready, minimal, clear)

## Stack (preferred)

* Next.js (TypeScript) for UI + backend routes
* DB: SQLite (dev), Postgres (prod)
* Auth: Spotify OAuth Authorization Code + PKCE
* Cache: in-memory LRU (dev), Redis optional (prod)
* Logging: structured JSON logs

## Key security controls

* No Spotify secrets in client
* Session cookies: HttpOnly, SameSite=Lax, Secure in prod
* Refresh tokens encrypted at rest
* Least-privilege scopes:

  * `playlist-modify-private` for creating private playlists
  * add `user-read-email`, `user-read-private` only if you actually display profile info
* Rate limiting (per IP, per session)
* Abuse controls: prompt length caps, repeated 429 cooldown

## Deployment notes

* New Spotify apps may be limited to 5 users in dev mode, so plan “guest-first” to demo broadly.
* Spotify explicitly frames dev mode as a sandbox and not a foundation for scaling a business.
* Use Postgres + Redis for production, and centralize logs/metrics.

---

# H) Testing

## Unit tests

* Vibe parser: BPM extraction, genre/mood detection, keyword normalization
* Ranking: relevant playlists score above irrelevant ones
* Diversity: ensures top-N includes variety

## Integration tests (mock Spotify)

* Search pagination behavior (limit=10 + offset)
* 429 handling and retry-after behavior
* OAuth callback flow (token exchange mocked)
* Playlist creation + add-items endpoint naming (`/items`)

## Manual test set (must pass)

* Your four example prompts return plausible ranked results with reasons
* Guest mode works end-to-end (no login required)
* Login enables “Generate playlist”; playlist appears in Spotify account
* Errors are clear (rate-limited, auth failure, Spotify restrictions)

---

# I) Observability

## Logging (structured)

* `requestId`, route name, latency, Spotify status codes, cache hit/miss, user/session (if present)
* Sample log views: “slow ranking”, “Spotify 429 spikes”, “auth failures”

## Metrics (basic)

* Requests per endpoint
* p50/p95 latency per endpoint
* Cache hit rate for recommendations
* Spotify error rate (401/403/429)
* Generate success rate

## Debugging “bad recs”

* Store top contributing reasons/features per result
* Add a dev-only “explain” panel showing which keywords matched and diversity penalties applied

---

# J) Evaluation + feedback loop (thumbs up/down)

## Data captured

* prompt → results shown → user feedback (+1/-1) per playlist
* generation events (playlist created) + optional follow-up rating

## How it improves ranking (policy-safe)

* Start with simple weight adjustments (no ML training on Spotify content)
* Use feedback to:

  * increase weight for matched mood/genre terms that correlate with positive ratings
  * decrease weight for generic titles/descriptions that correlate with negative ratings
* Personalization in v1: bias toward terms and genres the user consistently likes, derived from **their feedback and prompt history** (not by ingesting Spotify content into an AI model).

---

## MVP build checklist

* [ ] Vibe prompt → ranked playlists in guest mode (fast + cached)
* [ ] Reasons 2–5 per playlist (never claim verified BPM/keys for third-party playlists)
* [ ] Skeleton states + error banners + retry UX
* [ ] OAuth PKCE login works end-to-end
* [ ] Create private playlist + add items using `/items` endpoints
* [ ] Rate limiting + abuse controls
* [ ] DB persistence for requests/results/feedback
* [ ] Logs + basic metrics plan documented
* [ ] Deploy instructions + env var list (no secrets in client)