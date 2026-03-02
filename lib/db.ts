import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { env } from "@/lib/env";

const globalDb = globalThis as unknown as { db?: Database.Database };

function initSchema(db: Database.Database): void {
  db.exec(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      spotify_user_id TEXT UNIQUE NOT NULL,
      display_name TEXT,
      email TEXT,
      image_url TEXT,
      token_enc_blob TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS vibe_requests (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      prompt TEXT NOT NULL,
      prompt_hash TEXT NOT NULL,
      vibe_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS playlist_results (
      id TEXT PRIMARY KEY,
      vibe_request_id TEXT NOT NULL,
      playlist_id TEXT NOT NULL,
      playlist_name TEXT NOT NULL,
      playlist_url TEXT NOT NULL,
      image_url TEXT,
      owner_name TEXT,
      score REAL NOT NULL,
      reasons_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS feedback (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      vibe_request_id TEXT,
      playlist_id TEXT,
      generated_playlist_id TEXT,
      rating INTEGER NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_vibe_requests_hash_user_created
      ON vibe_requests (prompt_hash, user_id, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_playlist_results_request_score
      ON playlist_results (vibe_request_id, score DESC);

    CREATE INDEX IF NOT EXISTS idx_feedback_user_created
      ON feedback (user_id, created_at);
  `);
}

export function getDb(): Database.Database {
  if (globalDb.db) {
    return globalDb.db;
  }

  const dbPath = path.resolve(env.SQLITE_PATH);
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  initSchema(db);
  globalDb.db = db;
  return db;
}
