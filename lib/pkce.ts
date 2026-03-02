import { createHash, randomBytes } from "node:crypto";

function base64Url(input: Buffer): string {
  return input
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

export function createCodeVerifier(): string {
  return base64Url(randomBytes(64));
}

export function createCodeChallenge(verifier: string): string {
  const digest = createHash("sha256").update(verifier).digest();
  return base64Url(digest);
}
