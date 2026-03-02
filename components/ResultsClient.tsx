"use client";

import { useEffect, useMemo, useState } from "react";

const GENERATED_PREVIEW_STORAGE_KEY = "vf_generated_preview";

type RecommendationResponse = {
  viewer: { isAuthed: boolean };
  meta: { requestId: string; note: string };
  vibe: { keywords: string[]; genres: string[]; moods: string[]; bpmMin?: number; bpmMax?: number };
  results: Array<{
    playlistId: string;
    playlistName: string;
    playlistUrl: string;
    imageUrl?: string;
    ownerName: string;
    score: number;
    reasons: string[];
  }>;
};

type MeResponse = {
  isAuthed: boolean;
  displayName?: string | null;
};

type GeneratedTrack = {
  uri: string;
  name: string;
  artistNames: string[];
  albumName: string;
  imageUrl?: string;
  trackUrl?: string;
};

type GenerateResponse = {
  playlistId?: string;
  playlistUrl?: string;
  generationMode: string;
  note: string;
  tracks: GeneratedTrack[];
};

type PersistedPreview = {
  promptKey: string;
  generatedUrl: string | null;
  generationNote: string | null;
  generatedTracks: GeneratedTrack[];
};

function previewPlaceholder(): string {
  return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='88' height='88'%3E%3Crect width='88' height='88' fill='%23ececec'/%3E%3C/svg%3E";
}

export default function ResultsClient({ initialPrompt }: { initialPrompt: string }) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<RecommendationResponse | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [generatedTracks, setGeneratedTracks] = useState<GeneratedTrack[]>([]);
  const [generationNote, setGenerationNote] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [autoSaveAttempted, setAutoSaveAttempted] = useState(false);

  const canGenerate = data?.viewer.isAuthed ?? false;
  const promptKey = useMemo(() => prompt.trim().toLowerCase(), [prompt]);

  const bannerText = useMemo(() => {
    if (!data) {
      return null;
    }
    return data.meta.note;
  }, [data]);

  function clearPersistedGeneratedPreview(): void {
    if (typeof window === "undefined") {
      return;
    }
    window.sessionStorage.removeItem(GENERATED_PREVIEW_STORAGE_KEY);
  }

  function persistGeneratedPreview(nextData: PersistedPreview): void {
    if (typeof window === "undefined") {
      return;
    }
    if (nextData.generatedTracks.length === 0 && !nextData.generatedUrl) {
      clearPersistedGeneratedPreview();
      return;
    }
    window.sessionStorage.setItem(GENERATED_PREVIEW_STORAGE_KEY, JSON.stringify(nextData));
  }

  function restorePersistedGeneratedPreview(): PersistedPreview | null {
    if (typeof window === "undefined") {
      return null;
    }

    const raw = window.sessionStorage.getItem(GENERATED_PREVIEW_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as PersistedPreview;
    } catch {
      clearPersistedGeneratedPreview();
      return null;
    }
  }

  async function refreshViewer(): Promise<void> {
    try {
      const response = await fetch("/api/me", { cache: "no-store" });
      const body = (await response.json()) as MeResponse;
      setDisplayName(body.displayName ?? null);
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleLogin(): Promise<void> {
    const next = `${window.location.pathname}${window.location.search}`;
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ next })
    });
    const body = await response.json();
    if (body.authUrl) {
      window.location.href = body.authUrl;
    }
  }

  async function handleLogout(): Promise<void> {
    await fetch("/api/auth/logout", { method: "POST" });
    setDisplayName(null);
    if (data) {
      setData({
        ...data,
        viewer: { isAuthed: false }
      });
    }
    setGeneratedUrl(null);
    setAutoSaveAttempted(false);
    persistGeneratedPreview({
      promptKey,
      generatedUrl: null,
      generationNote,
      generatedTracks
    });
  }

  async function runRecommendation(options?: { preservePreview?: boolean }): Promise<void> {
    setLoading(true);
    setError(null);
    setGeneratedUrl(null);
    setGeneratedTracks([]);
    setGenerationNote(null);
    setAutoSaveAttempted(false);

    if (!options?.preservePreview) {
      clearPersistedGeneratedPreview();
    }

    try {
      const response = await fetch("/api/vibe/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, limit: 12 })
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body?.error?.message ?? "Request failed");
        return;
      }
      setData(body);
    } catch {
      setError("Could not reach server.");
    } finally {
      setLoading(false);
    }
  }

  async function sendFeedback(playlistId: string, rating: 1 | -1): Promise<void> {
    if (!data) {
      return;
    }
    await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestId: data.meta.requestId,
        playlistId,
        rating
      })
    });
  }

  async function generatePlaylist(options?: { previewUris?: string[]; preserveExistingTracks?: boolean }): Promise<void> {
    if (!data) {
      return;
    }

    setGenerating(true);
    try {
      const response = await fetch("/api/vibe/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: data.meta.requestId,
          length: 40,
          previewUris: options?.previewUris
        })
      });
      const body = (await response.json()) as GenerateResponse & { error?: { message?: string } };
      if (!response.ok) {
        setError(body?.error?.message ?? "Generation failed");
        return;
      }

      const nextGeneratedUrl = body.playlistUrl ?? null;
      const nextGeneratedTracks =
        body.tracks && body.tracks.length > 0
          ? body.tracks
          : options?.preserveExistingTracks
            ? generatedTracks
            : [];
      const nextGenerationNote = body.note ?? null;

      setGeneratedUrl(nextGeneratedUrl);
      setGeneratedTracks(nextGeneratedTracks);
      setGenerationNote(nextGenerationNote);
      persistGeneratedPreview({
        promptKey,
        generatedUrl: nextGeneratedUrl,
        generationNote: nextGenerationNote,
        generatedTracks: nextGeneratedTracks
      });
    } catch (caughtError) {
      setError((caughtError as Error)?.message ?? "Generation failed with an unexpected error.");
    } finally {
      setGenerating(false);
    }
  }

  useEffect(() => {
    runRecommendation({ preservePreview: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt]);

  useEffect(() => {
    refreshViewer();
  }, []);

  useEffect(() => {
    if (!data) {
      return;
    }

    const saved = restorePersistedGeneratedPreview();
    if (!saved || saved.promptKey !== promptKey) {
      return;
    }

    setGeneratedUrl(saved.generatedUrl ?? null);
    setGenerationNote(saved.generationNote ?? null);
    setGeneratedTracks(saved.generatedTracks ?? []);
  }, [data, promptKey]);

  useEffect(() => {
    if (!canGenerate || generating || generatedUrl || generatedTracks.length === 0 || autoSaveAttempted) {
      return;
    }

    setAutoSaveAttempted(true);
    generatePlaylist({
      previewUris: generatedTracks.map((track) => track.uri),
      preserveExistingTracks: true
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canGenerate, generating, generatedUrl, generatedTracks, autoSaveAttempted]);

  return (
    <div>
      <section className="panel">
        <label htmlFor="prompt-edit">Edit vibe prompt</label>
        <textarea id="prompt-edit" rows={4} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
        <div className="actions" style={{ marginTop: "0.7rem" }}>
          <button className="primary" onClick={() => runRecommendation()}>
            Run
          </button>
          <button className="warn" onClick={() => generatePlaylist()} disabled={generating || !data}>
            {generating
              ? "Generating..."
              : canGenerate
                ? "Generate playlist in Spotify"
                : "Generate preview playlist"}
          </button>
          {!authLoading &&
            (canGenerate ? (
              <>
                <button disabled>{displayName ? `Logged in as ${displayName}` : "Logged in to Spotify"}</button>
                <button onClick={handleLogout}>Log out</button>
              </>
            ) : (
              <button onClick={handleLogin}>Log in with Spotify</button>
            ))}
        </div>
        {!canGenerate && !authLoading && (
          <p className="meta" style={{ marginTop: "0.7rem" }}>
            You can browse recommendations as a guest. Generate a preview here, or log in to save it to Spotify without losing this page.
          </p>
        )}
      </section>

      {error && (
        <div className="banner error" style={{ marginTop: "0.8rem" }}>
          {error}
        </div>
      )}

      {bannerText && (
        <div className="banner info" style={{ marginTop: "0.8rem" }}>
          {bannerText}
        </div>
      )}

      {generatedUrl && (
        <div className="banner info" style={{ marginTop: "0.8rem" }}>
          Playlist created: <a href={generatedUrl}>Open playlist</a>
        </div>
      )}

      {generationNote && (
        <div className="banner info" style={{ marginTop: "0.8rem" }}>
          {generationNote}
        </div>
      )}

      {generatedTracks.length > 0 && (
        <section className="panel" style={{ marginTop: "0.9rem" }}>
          <h2 style={{ marginTop: 0 }}>{generatedUrl ? "Saved Tracklist" : "Preview Tracklist"}</h2>
          <div className="card-grid">
            {generatedTracks.map((track) => (
              <article key={track.uri} className="playlist-card">
                <img src={track.imageUrl ?? previewPlaceholder()} alt="album cover" />
                <div>
                  <h3 style={{ margin: "0 0 0.3rem" }}>{track.name}</h3>
                  <p className="meta" style={{ margin: 0 }}>
                    {track.artistNames.join(", ") || "Unknown artist"}
                  </p>
                  {track.albumName && (
                    <p className="meta" style={{ marginTop: "0.35rem" }}>
                      Album: {track.albumName}
                    </p>
                  )}
                  {track.trackUrl && (
                    <div className="actions" style={{ marginTop: "0.5rem" }}>
                      <a href={track.trackUrl} target="_blank" rel="noreferrer">
                        <button>Open track</button>
                      </a>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
          {!generatedUrl && !canGenerate && (
            <p className="meta" style={{ marginTop: "0.8rem" }}>
              Log in with Spotify above to save this exact preview into your Spotify account.
            </p>
          )}
        </section>
      )}

      <section style={{ marginTop: "0.9rem" }}>
        <h2>Results</h2>
        {loading && (
          <div className="card-grid">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="skeleton" />
            ))}
          </div>
        )}

        {!loading && data && (
          <div className="card-grid">
            {data.results.map((row) => (
              <article key={row.playlistId} className="playlist-card">
                <img src={row.imageUrl ?? previewPlaceholder()} alt="playlist cover" />
                <div>
                  <h3 style={{ margin: "0 0 0.3rem" }}>{row.playlistName}</h3>
                  <p className="meta" style={{ margin: 0 }}>
                    by {row.ownerName}
                  </p>
                  <ul className="reason-list">
                    {row.reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                  <div className="actions">
                    <a href={row.playlistUrl} target="_blank" rel="noreferrer">
                      <button>Open in Spotify</button>
                    </a>
                    <button onClick={() => sendFeedback(row.playlistId, 1)}>Thumbs up</button>
                    <button onClick={() => sendFeedback(row.playlistId, -1)}>Thumbs down</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
