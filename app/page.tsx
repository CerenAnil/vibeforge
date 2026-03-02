"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const examples = [
  "late-night neon cyberpunk drive, moody but hopeful, 110-130 BPM",
  "warm coffee shop indie-folk with light percussion",
  "dark cinematic workout energy, no pop"
];

export default function HomePage() {
  const router = useRouter();
  const [prompt, setPrompt] = useState(examples[0]);
  const [busy, setBusy] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [isAuthed, setIsAuthed] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);

  async function handleLogin(): Promise<void> {
    setBusy(true);
    try {
      const response = await fetch("/api/auth/login", { method: "POST" });
      const body = await response.json();
      if (body.authUrl) {
        window.location.href = body.authUrl;
        return;
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout(): Promise<void> {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setIsAuthed(false);
      setDisplayName(null);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    async function loadMe(): Promise<void> {
      try {
        const response = await fetch("/api/me", { cache: "no-store" });
        const body = await response.json();
        setIsAuthed(Boolean(body?.isAuthed));
        setDisplayName(body?.displayName ?? null);
      } finally {
        setAuthLoading(false);
      }
    }
    loadMe();
  }, []);

  return (
    <main>
      <h1>Vibeforge</h1>
      <p className="meta">Turn a vibe into ranked Spotify playlist recommendations.</p>

      <section className="panel" style={{ marginTop: "1rem" }}>
        <label htmlFor="prompt">Describe your vibe</label>
        <textarea
          id="prompt"
          rows={6}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe mood, genres, context, and optional BPM range"
        />
        <div className="actions" style={{ marginTop: "0.8rem" }}>
          <button className="primary" onClick={() => router.push(`/results?prompt=${encodeURIComponent(prompt)}`)}>
            Get recommendations
          </button>
          {!authLoading &&
            (isAuthed ? (
              <>
                <button disabled>
                  Logged in{displayName ? ` as ${displayName}` : " to Spotify"}
                </button>
                <button onClick={handleLogout} disabled={busy}>
                  Log out
                </button>
              </>
            ) : (
              <button onClick={handleLogin} disabled={busy}>
                Log in with Spotify
              </button>
            ))}
        </div>
        <p className="meta" style={{ marginTop: "0.7rem" }}>
          Login enables private playlist generation in your account.
        </p>
      </section>

      <section style={{ marginTop: "1rem" }}>
        <h2>Examples</h2>
        <div className="actions">
          {examples.map((sample) => (
            <button key={sample} onClick={() => setPrompt(sample)}>
              {sample}
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
