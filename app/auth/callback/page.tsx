"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

export default function CallbackPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState("Signing in...");

  useEffect(() => {
    async function run(): Promise<void> {
      const code = searchParams.get("code");
      const state = searchParams.get("state");
      const oauthError = searchParams.get("error");
      const oauthDescription = searchParams.get("error_description");

      if (oauthError) {
        setStatus(
          oauthDescription
            ? `Spotify authorization failed: ${oauthDescription}`
            : `Spotify authorization failed: ${oauthError}`
        );
        return;
      }

      if (!code) {
        setStatus("Authorization code missing.");
        return;
      }
      try {
        const response = await fetch("/api/auth/callback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, state })
        });
        const body = await response.json().catch(() => null);

        if (!response.ok) {
          setStatus(body?.error?.message ?? "Login failed. Retry login and verify redirect URI.");
          return;
        }

        setStatus("Login successful. Redirecting...");
        setTimeout(() => router.push(body?.redirectTo ?? "/"), 900);
      } catch (error) {
        setStatus(`Login failed. ${(error as Error)?.message ?? "Unexpected callback error."}`);
      }
    }

    run();
  }, [router, searchParams]);

  return (
    <main>
      <h1>Spotify Callback</h1>
      <p className="meta">{status}</p>
    </main>
  );
}
