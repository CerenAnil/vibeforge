# Vibeforge

Vibe -> ranked playlist recommendations with explainability, plus optional Spotify playlist generation.

## What is implemented

- Next.js + TypeScript app with guest-first recommendation flow
- `POST /api/vibe/recommendations`: prompt -> ranked playlists + reasons
- `POST /api/vibe/generate`: authenticated private playlist creation using search fallback
- `POST /api/feedback`: thumbs up/down capture
- `GET /api/me`, `POST /api/auth/login`, `POST /api/auth/callback`, `POST /api/auth/logout`
- OAuth Authorization Code + PKCE with HttpOnly session cookie
- SQLite persistence (`users`, `sessions`, `vibe_requests`, `playlist_results`, `feedback`)
- In-memory LRU cache and token-bucket rate limiting
- Unit tests for parser and ranking

## Setup

1. Copy `.env.example` to `.env.local` and fill values.
2. Install deps: `npm install`
3. Start app: `npm run dev`

## Notes

- Recommendations are search-only by design to remain resilient under Spotify endpoint restrictions.
- Playlist item insertion uses Spotify `/items` endpoint naming.
- This implementation stores encrypted refresh tokens at rest using `TOKEN_ENCRYPTION_KEY`.
