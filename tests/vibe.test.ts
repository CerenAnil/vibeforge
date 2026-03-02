import { describe, expect, it } from "vitest";
import { buildSearchQueries, buildVibeProfile, parseBpm } from "@/lib/vibe";

describe("vibe parser", () => {
  it("parses BPM range", () => {
    const bpm = parseBpm("moody but hopeful 110-130 bpm");
    expect(bpm.min).toBe(110);
    expect(bpm.max).toBe(130);
  });

  it("extracts genres and moods", () => {
    const vibe = buildVibeProfile("late night cyberpunk synthwave moody hopeful");
    expect(vibe.genres).toContain("electronic");
    expect(vibe.genres).toContain("synthwave");
    expect(vibe.moods).toContain("moody");
    expect(vibe.moods).toContain("hopeful");
    expect(vibe.phrases).toContain("late night");
  });

  it("parses excludes and workout intent", () => {
    const vibe = buildVibeProfile("energy boosting and motivating towards doing sports, no pop");
    expect(vibe.excludeKeywords).toContain("pop");
    expect(vibe.contexts).toContain("workout");
    expect(vibe.moods).toContain("motivating");
  });

  it("expands contextual and genre-rich searches", () => {
    const vibe = buildVibeProfile("late night drum and bass coding focus, no pop");
    const queries = buildSearchQueries(vibe);

    expect(vibe.genres).toContain("electronic");
    expect(vibe.contexts).toContain("focus");
    expect(vibe.contexts).toContain("late-night");
    expect(queries.some((query) => query.includes("focus"))).toBe(true);
    expect(queries.some((query) => query.includes("electronic") || query.includes("edm"))).toBe(true);
    expect(queries.some((query) => query.includes("-pop"))).toBe(true);
  });

  it("classifies language and region prompts", () => {
    const vibe = buildVibeProfile("turkish pop and uk rap");
    const queries = buildSearchQueries(vibe);

    expect(vibe.languages).toContain("turkish");
    expect(vibe.regions).toContain("turkey");
    expect(vibe.regions).toContain("uk");
    expect(vibe.genres).toContain("pop");
    expect(vibe.genres).toContain("hip-hop");
    expect(queries.some((query) => query.includes("turkish"))).toBe(true);
    expect(queries.some((query) => query.includes("uk") || query.includes("british"))).toBe(true);
  });
});
