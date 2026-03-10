import { describe, it, expect, vi } from "vitest";

// Mock supabase
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: vi.fn(() => Promise.reject(new Error("no LLM in tests"))),
    },
  },
}));

import { generateFallbackQuestions, composeFinalPrompt } from "@/lib/planningQuestions";

describe("generateFallbackQuestions", () => {
  it("should generate questions for a vague brief", () => {
    const questions = generateFallbackQuestions("I want to redesign my space");
    expect(questions.length).toBeGreaterThan(3);
    const ids = questions.map((q) => q.id);
    expect(ids).toContain("room");
    expect(ids).toContain("size");
    expect(ids).toContain("style");
    expect(ids).toContain("budget");
    expect(ids).toContain("special");
  });

  it("should skip room question when room is mentioned", () => {
    const questions = generateFallbackQuestions("modern living room redesign");
    const ids = questions.map((q) => q.id);
    expect(ids).not.toContain("room");
  });

  it("should skip style question when style is mentioned", () => {
    const questions = generateFallbackQuestions("scandinavian design for my space");
    const ids = questions.map((q) => q.id);
    expect(ids).not.toContain("style");
  });

  it("should skip budget question when budget is mentioned", () => {
    const questions = generateFallbackQuestions("design with $10k budget");
    const ids = questions.map((q) => q.id);
    expect(ids).not.toContain("budget");
  });

  it("should skip size question when dimensions are given", () => {
    const questions = generateFallbackQuestions("room is 20x15 sqft");
    const ids = questions.map((q) => q.id);
    expect(ids).not.toContain("size");
  });

  it("should always include function and special questions", () => {
    const questions = generateFallbackQuestions("modern scandinavian living room 300 sqft $20k budget");
    const ids = questions.map((q) => q.id);
    expect(ids).toContain("function");
    expect(ids).toContain("special");
  });
});

describe("composeFinalPrompt", () => {
  it("should combine brief and answers into a prompt", () => {
    const result = composeFinalPrompt("modern living room", {
      size: "Medium (150–400 sqft)",
      budget: "$15k – $30k",
    });
    expect(result).toContain("modern living room");
    expect(result).toContain("size: Medium");
    expect(result).toContain("budget: $15k");
    expect(result.endsWith(".")).toBe(true);
  });

  it("should skip empty answers", () => {
    const result = composeFinalPrompt("brief", {
      room: "Kitchen",
      style: "",
    });
    expect(result).toContain("room: Kitchen");
    expect(result).not.toContain("style:");
  });

  it("should handle empty answers object", () => {
    const result = composeFinalPrompt("my brief", {});
    expect(result).toBe("my brief.");
  });
});
