import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { env } from "@/lib/env";

function getKey(): Buffer {
  const decoded = Buffer.from(env.TOKEN_ENCRYPTION_KEY, "base64");
  if (decoded.length === 32) {
    return decoded;
  }
  return createHash("sha256").update(env.TOKEN_ENCRYPTION_KEY).digest();
}

export function encryptJson(payload: unknown): string {
  const iv = randomBytes(12);
  const key = getKey();
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.from(JSON.stringify(payload), "utf8");
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decryptJson<T>(blob: string): T {
  const raw = Buffer.from(blob, "base64");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const body = raw.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(tag);
  const out = Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
  return JSON.parse(out) as T;
}
