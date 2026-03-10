import { describe, it, expect, vi, beforeEach } from "vitest";
import { SkillRegistry } from "@/lib/skills/registry";
import type { SkillPlugin, SkillContext, SkillManifest } from "@/lib/skills/types";

// Mock supabase
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      insert: () => ({ select: () => ({ single: () => ({ data: { id: "session-1" }, error: null }) }) }),
      select: () => ({ eq: () => ({ order: () => ({ limit: () => ({ data: [], error: null }) }) }) }),
      update: () => ({ eq: () => ({ data: null, error: null }) }),
    }),
    functions: {
      invoke: vi.fn().mockResolvedValue({
        data: { success: true, analysis: { projectType: "residential", style: "modern", budget: null, timeline: "standard", providedAssets: [], requiredDeliverables: ["renders", "shopping"], materials: [], lighting: null, dimensions: null, clientPreferences: [] }, engine: "mock" },
        error: null,
      }),
    },
  },
}));

const mockContext: SkillContext = {
  projectId: "test-project",
  userId: "test-user",
  projectType: "interior",
  supabase: {},
  config: {},
  addFeedEntry: vi.fn(),
  getEnabledSkills: () => ["mock-render"],
  emitEvent: vi.fn(),
};

function createMockRenderSkill(): SkillPlugin {
  return {
    manifest: {
      slug: "mock-render",
      name: "Mock Render",
      version: "1.0.0",
      description: "Mock render skill for testing",
      disciplines: ["interior"],
      requiredSecrets: [],
      agentTools: [{
        name: "generate_render",
        description: "Generate a mock render",
        parameters: { type: "object", properties: { style: { type: "string" } } },
      }],
      hooks: ["onBriefAnalyzed", "onSessionComplete"],
    },
    onLoad: vi.fn().mockResolvedValue(undefined),
    executeTool: vi.fn().mockResolvedValue({
      success: true,
      data: {
        renders: [{ id: "r1", url: "https://example.com/render.png", label: "Mock Render", style: "modern", resolution: "1024x1024", generated_at: new Date().toISOString() }],
      },
    }),
    onUnload: vi.fn().mockResolvedValue(undefined),
    onBriefAnalyzed: vi.fn(),
    onSessionComplete: vi.fn(),
  };
}

describe("DesignerAgent integration with SkillRegistry", () => {
  let registry: SkillRegistry;
  let mockRenderSkill: SkillPlugin;

  beforeEach(() => {
    registry = new SkillRegistry();
    mockRenderSkill = createMockRenderSkill();
    registry.register(mockRenderSkill);
  });

  it("registers and enables mock render skill", async () => {
    await registry.loadAll(["mock-render"], mockContext);
    expect(mockRenderSkill.onLoad).toHaveBeenCalledWith(mockContext);
    expect(registry.getEnabledSlugs()).toContain("mock-render");
  });

  it("executeTool routes to mock render skill", async () => {
    await registry.loadAll(["mock-render"], mockContext);
    const result = await registry.executeTool("generate_render", { style: "modern" }, mockContext);
    expect(result.success).toBe(true);
    expect(result.data.renders).toHaveLength(1);
    expect(mockRenderSkill.executeTool).toHaveBeenCalledWith("generate_render", { style: "modern" }, mockContext);
  });

  it("fireHook calls onBriefAnalyzed on mock render skill", async () => {
    await registry.loadAll(["mock-render"], mockContext);
    const analysis = { projectType: "residential", style: "modern" };
    await registry.fireHook("onBriefAnalyzed", analysis, mockContext);
    expect(mockRenderSkill.onBriefAnalyzed).toHaveBeenCalledWith(analysis, mockContext);
  });

  it("fireHook calls onSessionComplete on mock render skill", async () => {
    await registry.loadAll(["mock-render"], mockContext);
    const session = { id: "s1" };
    const result = { renders: [] };
    await registry.fireHook("onSessionComplete", session, result, mockContext);
    expect(mockRenderSkill.onSessionComplete).toHaveBeenCalledWith(session, result, mockContext);
  });

  it("getAllToolDefinitions includes mock render tools", async () => {
    await registry.loadAll(["mock-render"], mockContext);
    const tools = registry.getAllToolDefinitions();
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe("generate_render");
  });

  it("disabled skill tools are excluded", async () => {
    await registry.loadAll(["mock-render"], mockContext);
    await registry.setEnabled("mock-render", false);
    const tools = registry.getAllToolDefinitions();
    expect(tools).toHaveLength(0);
  });
});
