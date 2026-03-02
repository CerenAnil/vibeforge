import { describe, expect, it } from "vitest";
import { rankAndDiversify } from "@/lib/rank";
import { buildVibeProfile } from "@/lib/vibe";

describe("ranking", () => {
  it("ranks relevant playlist higher", () => {
    const vibe = buildVibeProfile("moody synthwave cyberpunk late night");
    const ranked = rankAndDiversify(
      vibe,
      [
        {
          playlistId: "1",
          playlistName: "Cyberpunk Synthwave Night Drive",
          playlistUrl: "https://x/1",
          ownerName: "A",
          description: "moody neon late night outrun mix"
        },
        {
          playlistId: "2",
          playlistName: "Morning acoustic birds",
          playlistUrl: "https://x/2",
          ownerName: "B",
          description: "gentle wake-up acoustic"
        }
      ],
      2
    );

    expect(ranked[0].playlistId).toBe("1");
  });
});
