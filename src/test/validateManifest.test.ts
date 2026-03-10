import { describe, it, expect } from "vitest";
import { validateManifest } from "@/lib/skills/validate-manifest";

const validManifest = {
  slug: "test-skill",
  name: "Test Skill",
  version: "1.0.0",
  description: "A test skill",
  disciplines: ["interior"],
  requiredSecrets: [],
  agentTools: [{ name: "test_tool", description: "A test tool", parameters: {} }],
};

describe("validateManifest", () => {
  it("returns true for a valid manifest", () => {
    expect(validateManifest(validManifest)).toBe(true);
  });

  it("returns true with all optional fields", () => {
    expect(validateManifest({
      ...validManifest,
      requiredTables: ["renders"],
      edgeFunctions: ["generate-render"],
      uiComponents: ["RenderGallery"],
      optional: true,
      defaultEnabled: false,
      hooks: ["onBriefAnalyzed", "onSessionComplete"],
      configSchema: { apiKey: { type: "string" } },
    })).toBe(true);
  });

  it("returns false for null", () => { expect(validateManifest(null)).toBe(false); });
  it("returns false for non-object", () => { expect(validateManifest("string")).toBe(false); });

  it("returns false for missing slug", () => {
    const { slug, ...rest } = validManifest;
    expect(validateManifest(rest)).toBe(false);
  });

  it("returns false for invalid slug pattern", () => {
    expect(validateManifest({ ...validManifest, slug: "Invalid Slug!" })).toBe(false);
  });

  it("returns false for empty name", () => {
    expect(validateManifest({ ...validManifest, name: "" })).toBe(false);
  });

  it("returns false for invalid version", () => {
    expect(validateManifest({ ...validManifest, version: "abc" })).toBe(false);
  });

  it("returns false for missing disciplines", () => {
    const { disciplines, ...rest } = validManifest;
    expect(validateManifest(rest)).toBe(false);
  });

  it("returns false for empty disciplines", () => {
    expect(validateManifest({ ...validManifest, disciplines: [] })).toBe(false);
  });

  it("returns false for invalid discipline", () => {
    expect(validateManifest({ ...validManifest, disciplines: ["invalid"] })).toBe(false);
  });

  it("returns false for missing agentTools", () => {
    const { agentTools, ...rest } = validManifest;
    expect(validateManifest(rest)).toBe(false);
  });

  it("returns false for invalid tool name", () => {
    expect(validateManifest({
      ...validManifest,
      agentTools: [{ name: "Invalid-Tool", description: "bad", parameters: {} }],
    })).toBe(false);
  });

  it("returns false for tool missing parameters", () => {
    expect(validateManifest({
      ...validManifest,
      agentTools: [{ name: "test_tool", description: "test" }],
    })).toBe(false);
  });

  it("returns false for invalid hook name", () => {
    expect(validateManifest({ ...validManifest, hooks: ["onInvalidHook"] })).toBe(false);
  });

  it("accepts all valid disciplines", () => {
    for (const d of ["interior", "architectural", "landscape", "industrial"]) {
      expect(validateManifest({ ...validManifest, disciplines: [d] })).toBe(true);
    }
  });
});
