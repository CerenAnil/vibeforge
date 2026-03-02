import { env } from "@/lib/env";
import { getAppToken, setAppToken } from "@/lib/cache";
import { logInfo } from "@/lib/logger";
import type { PlaylistCandidate, TrackCandidate } from "@/lib/types";

const ACCOUNTS_BASE = "https://accounts.spotify.com";
const API_BASE = "https://api.spotify.com/v1";

type SpotifyTokenResponse = {
  access_token: string;
  token_type: "Bearer";
  scope?: string;
  expires_in: number;
  refresh_token?: string;
};

export class SpotifyApiError extends Error {
  status: number;
  retryAfterSec?: number;

  constructor(message: string, status: number, retryAfterSec?: number) {
    super(message);
    this.name = "SpotifyApiError";
    this.status = status;
    this.retryAfterSec = retryAfterSec;
  }
}

function basicAuthHeader(clientId: string, clientSecret: string): string {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const text = await response.text();
    const retryAfter = response.headers.get("retry-after");
    const retryAfterSec = retryAfter ? Number(retryAfter) : undefined;
    throw new SpotifyApiError(`Spotify error ${response.status}: ${text}`, response.status, retryAfterSec);
  }
  return (await response.json()) as T;
}

export async function getClientCredentialsToken(): Promise<string> {
  const cached = getAppToken();
  if (cached) {
    return cached;
  }

  const body = new URLSearchParams({ grant_type: "client_credentials" });
  const token = await fetchJson<SpotifyTokenResponse>(`${ACCOUNTS_BASE}/api/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: basicAuthHeader(env.SPOTIFY_CLIENT_ID, env.SPOTIFY_CLIENT_SECRET)
    },
    body
  });

  setAppToken(token.access_token, token.expires_in);
  return token.access_token;
}

export async function exchangeAuthCode(
  code: string,
  codeVerifier: string
): Promise<SpotifyTokenResponse> {
  const pkceBody = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: env.SPOTIFY_REDIRECT_URI,
    client_id: env.SPOTIFY_CLIENT_ID,
    code_verifier: codeVerifier
  });

  try {
    return await fetchJson<SpotifyTokenResponse>(`${ACCOUNTS_BASE}/api/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: pkceBody
    });
  } catch {
    // Some Spotify app configurations still require confidential-client auth at token exchange.
    const confidentialBody = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: env.SPOTIFY_REDIRECT_URI,
      code_verifier: codeVerifier
    });

    return fetchJson<SpotifyTokenResponse>(`${ACCOUNTS_BASE}/api/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: basicAuthHeader(env.SPOTIFY_CLIENT_ID, env.SPOTIFY_CLIENT_SECRET)
      },
      body: confidentialBody
    });
  }
}

export async function refreshAccessToken(refreshToken: string): Promise<SpotifyTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken
  });

  return fetchJson<SpotifyTokenResponse>(`${ACCOUNTS_BASE}/api/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: basicAuthHeader(env.SPOTIFY_CLIENT_ID, env.SPOTIFY_CLIENT_SECRET)
    },
    body
  });
}

export async function spotifySearchPlaylists(
  query: string,
  offset = 0,
  token?: string
): Promise<PlaylistCandidate[]> {
  const accessToken = token ?? (await getClientCredentialsToken());
  const url = new URL(`${API_BASE}/search`);
  url.searchParams.set("q", query);
  url.searchParams.set("type", "playlist");
  url.searchParams.set("limit", "10");
  url.searchParams.set("offset", String(offset));

  const data = await fetchJson<{
    playlists: {
      items: Array<{
        id: string;
        name: string;
        description: string;
        external_urls?: { spotify?: string };
        images?: Array<{ url: string }>;
        owner?: { display_name?: string };
      } | null>;
    };
  }>(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  return data.playlists.items
    .filter(
      (
        p
      ): p is {
        id: string;
        name: string;
        description: string;
        external_urls?: { spotify?: string };
        images?: Array<{ url: string }>;
        owner?: { display_name?: string };
      } => Boolean(p && p.id && p.external_urls?.spotify)
    )
    .map((p) => ({
      playlistId: p.id,
      playlistName: p.name,
      playlistUrl: p.external_urls?.spotify ?? `https://open.spotify.com/playlist/${p.id}`,
      imageUrl: p.images?.[0]?.url,
      ownerName: p.owner?.display_name ?? "Unknown",
      description: p.description ?? ""
    }));
}

export async function spotifySearchTracks(
  query: string,
  limit = 25,
  token?: string
): Promise<TrackCandidate[]> {
  const accessToken = token ?? (await getClientCredentialsToken());
  const url = new URL(`${API_BASE}/search`);
  url.searchParams.set("q", query);
  url.searchParams.set("type", "track");
  url.searchParams.set("limit", String(Math.min(10, limit)));

  const data = await fetchJson<{
    tracks: {
      items: Array<{
        uri: string;
        name: string;
        album?: {
          name?: string;
          images?: Array<{ url: string }>;
        };
        artists?: Array<{ name: string }>;
        external_urls?: { spotify?: string };
      } | null>;
    };
  }>(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  return data.tracks.items
    .filter(
      (
        t
      ): t is {
        uri: string;
        name: string;
        album?: {
          name?: string;
          images?: Array<{ url: string }>;
        };
        artists?: Array<{ name: string }>;
        external_urls?: { spotify?: string };
      } => Boolean(t?.uri && t?.name)
    )
    .map((t) => ({
      uri: t.uri,
      name: t.name,
      artistNames: t.artists?.map((artist) => artist.name).filter(Boolean) ?? [],
      albumName: t.album?.name ?? "",
      imageUrl: t.album?.images?.[0]?.url,
      trackUrl: t.external_urls?.spotify
    }));
}

export async function fetchMe(accessToken: string): Promise<{ id: string; display_name: string; email?: string; images?: Array<{ url: string }> }> {
  return fetchJson(`${API_BASE}/me`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
}

export async function createPlaylist(
  accessToken: string,
  name: string,
  description: string
): Promise<{ id: string; external_urls: { spotify: string } }> {
  return fetchJson(`${API_BASE}/me/playlists`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name,
      description,
      public: false
    })
  });
}

export async function addItemsToPlaylist(
  accessToken: string,
  playlistId: string,
  uris: string[]
): Promise<void> {
  if (uris.length === 0) {
    return;
  }

  await fetchJson(`${API_BASE}/playlists/${playlistId}/items`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ uris: uris.slice(0, 100) })
  });
}

export async function buildAuthUrl(codeChallenge: string, state: string): Promise<string> {
  const url = new URL(`${ACCOUNTS_BASE}/authorize`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", env.SPOTIFY_CLIENT_ID);
  url.searchParams.set("redirect_uri", env.SPOTIFY_REDIRECT_URI);
  url.searchParams.set("scope", ["playlist-modify-private", "user-read-private", "user-read-email"].join(" "));
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("state", state);
  logInfo("spotify.auth_url", { state });
  return url.toString();
}
