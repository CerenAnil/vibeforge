# Vibeforge

Vibe -> ranked playlist recommendations with explainability, plus optional Spotify playlist generation.

## Architecture

```text
User
 |
 v
Next.js frontend (React 19 + TypeScript)
 |  Home -> Results -> OAuth callback
 |  Guest recommendations + optional Spotify login
 |
 +-- POST /api/vibe/recommendations
 |      parse prompt -> build search queries -> Spotify Search -> rank/diversify
 |
 +-- POST /api/vibe/generate
 |      guest: build preview tracklist
 |      authed: save preview as private Spotify playlist
 |
 +-- Auth routes (/api/auth/*)
 |      PKCE login -> token exchange -> session cookie
 |
 v
Backend services (Next.js route handlers)
 |-- lib/vibe.ts       prompt parsing, genre/mood/context/language extraction
 |-- lib/rank.ts       scoring, diversity, explainability
 |-- lib/spotify.ts    Spotify API client
 |-- lib/session.ts    session handling
 |-- lib/db.ts         SQLite persistence
 |
 v
Spotify Web API + SQLite
```

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 15, React 19, TypeScript |
| Styling | Global CSS (`app/globals.css`) |
| Backend | Next.js route handlers (Node runtime) |
| Spotify integration | Spotify Web API + OAuth Authorization Code with PKCE |
| Database | SQLite via `better-sqlite3` |
| Validation | `zod` |
| Caching | `lru-cache` |
| Rate limiting | in-memory token bucket |
| Security | HttpOnly cookies, encrypted refresh token storage |
| Testing | Vitest |

## What is implemented

- Next.js + TypeScript app with guest-first recommendation flow
- `POST /api/vibe/recommendations`: prompt -> ranked playlists + reasons
- `POST /api/vibe/generate`: guest preview generation or authenticated private playlist creation
- `POST /api/feedback`: thumbs up/down capture
- `GET /api/me`, `POST /api/auth/login`, `POST /api/auth/callback`, `POST /api/auth/logout`
- OAuth Authorization Code + PKCE with HttpOnly session cookie
- SQLite persistence (`users`, `sessions`, `vibe_requests`, `playlist_results`, `feedback`)
- In-memory LRU cache and token-bucket rate limiting
- Unit tests for parser and ranking

## Screenshots

### Home Screen

![Home Screen](<screenshots/Screenshot 2026-03-02 at 9.10.22 PM.png>)

### Recommendations

![Recommendations](<screenshots/Screenshot 2026-03-02 at 9.10.44 PM.png>)

### Guest Preview Tracklist

![Guest Preview Tracklist](<screenshots/Screenshot 2026-03-02 at 9.11.03 PM.png>)

### Saved Playlist Flow

![Saved Playlist Flow](<screenshots/Screenshot 2026-03-02 at 9.11.33 PM.png>)

## Project Structure

```text
Vibeforge/
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── callback/route.ts        # OAuth callback + session creation
│   │   │   ├── login/route.ts           # PKCE login bootstrap
│   │   │   └── logout/route.ts          # Session clear
│   │   ├── feedback/route.ts            # Thumbs up/down persistence
│   │   ├── me/route.ts                  # Current auth state
│   │   └── vibe/
│   │       ├── generate/route.ts        # Preview generation + save to Spotify
│   │       └── recommendations/route.ts # Prompt -> ranked playlists
│   ├── auth/callback/page.tsx           # Client callback status page
│   ├── results/page.tsx                 # Results screen
│   ├── globals.css                      # Global styles
│   ├── layout.tsx                       # Root layout
│   └── page.tsx                         # Home screen
├── components/
│   └── ResultsClient.tsx                # Results UI, auth-aware generation flow
├── lib/
│   ├── cache.ts                         # LRU caches
│   ├── crypto.ts                        # Token encryption/decryption
│   ├── db.ts                            # SQLite init + schema
│   ├── env.ts                           # Environment validation
│   ├── logger.ts                        # Structured logging helpers
│   ├── pkce-store.ts                    # Temporary PKCE verifier fallback store
│   ├── pkce.ts                          # PKCE helpers
│   ├── rank.ts                          # Ranking + diversity logic
│   ├── rate-limit.ts                    # Token-bucket rate limiting
│   ├── request-id.ts                    # Request ID generation
│   ├── session.ts                       # Session cookie handling
│   ├── spotify.ts                       # Spotify API client
│   ├── types.ts                         # Shared types
│   └── vibe.ts                          # Prompt parsing + query generation
├── tests/
│   ├── rank.test.ts                     # Ranking tests
│   └── vibe.test.ts                     # Vibe parser tests
├── screenshots/                         # README screenshots / demo images
├── package.json
└── README.md
```

## Setup

1. Copy `.env.example` to `.env.local` and fill values.
2. Install deps: `npm install`
3. Start app: `npm run dev`

## Notes

- Recommendations are search-only by design to remain resilient under Spotify endpoint restrictions.
- Playlist item insertion uses Spotify `/items` endpoint naming.
- This implementation stores encrypted refresh tokens at rest using `TOKEN_ENCRYPTION_KEY`.
- No LLM is used in the recommendation pipeline; the system is rule-based + search-based.
