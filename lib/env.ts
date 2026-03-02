import { z } from "zod";

const envSchema = z.object({
  SPOTIFY_CLIENT_ID: z.string().min(1),
  SPOTIFY_CLIENT_SECRET: z.string().min(1),
  SPOTIFY_REDIRECT_URI: z.string().url(),
  APP_BASE_URL: z.string().url(),
  SESSION_SECRET: z.string().min(16),
  TOKEN_ENCRYPTION_KEY: z.string().min(10),
  SQLITE_PATH: z.string().default("./data/app.db")
});

export const env = envSchema.parse({
  SPOTIFY_CLIENT_ID: process.env.SPOTIFY_CLIENT_ID,
  SPOTIFY_CLIENT_SECRET: process.env.SPOTIFY_CLIENT_SECRET,
  SPOTIFY_REDIRECT_URI: process.env.SPOTIFY_REDIRECT_URI,
  APP_BASE_URL: process.env.APP_BASE_URL,
  SESSION_SECRET: process.env.SESSION_SECRET,
  TOKEN_ENCRYPTION_KEY: process.env.TOKEN_ENCRYPTION_KEY,
  SQLITE_PATH: process.env.SQLITE_PATH
});
