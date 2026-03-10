import { describe, it, expect } from "vitest";

describe("workspace data types", () => {
  it("should export valid Asset type structure", async () => {
    const mod = await import("@/data/workspace-data");
    expect(mod.riversideAssets).toBeDefined();
    expect(Array.isArray(mod.riversideAssets)).toBe(true);
    if (mod.riversideAssets.length > 0) {
      const asset = mod.riversideAssets[0];
      expect(asset).toHaveProperty("id");
      expect(asset).toHaveProperty("name");
      expect(asset).toHaveProperty("category");
    }
  });

  it("should export valid FeedEntry type structure", async () => {
    const mod = await import("@/data/workspace-data");
    expect(mod.riversideFeed).toBeDefined();
    expect(Array.isArray(mod.riversideFeed)).toBe(true);
    if (mod.riversideFeed.length > 0) {
      const entry = mod.riversideFeed[0];
      expect(entry).toHaveProperty("id");
      expect(entry).toHaveProperty("time");
      expect(entry).toHaveProperty("text");
    }
  });
});
