export type VibeProfile = {
  keywords: string[];
  phrases: string[];
  contexts: string[];
  excludeKeywords: string[];
  languages: string[];
  regions: string[];
  genres: string[];
  moods: string[];
  bpmMin?: number;
  bpmMax?: number;
  targets: {
    energy?: number;
    valence?: number;
    danceability?: number;
    acousticness?: number;
  };
};

export type PlaylistCandidate = {
  playlistId: string;
  playlistName: string;
  playlistUrl: string;
  imageUrl?: string;
  ownerName: string;
  description: string;
  score?: number;
  reasons?: string[];
};

export type RankedPlaylist = PlaylistCandidate & {
  score: number;
  reasons: string[];
};

export type TrackCandidate = {
  uri: string;
  name: string;
  artistNames: string[];
  albumName: string;
  imageUrl?: string;
  trackUrl?: string;
};

export type ApiErrorCode =
  | "bad_request"
  | "unauthorized"
  | "rate_limited"
  | "spotify_error"
  | "not_found";

export type AppError = {
  error: {
    code: ApiErrorCode;
    message: string;
    retryAfterSec?: number;
  };
};
