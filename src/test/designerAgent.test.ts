import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock supabase before importing the module
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({
            data: {
              id: "test-session-1",
              project_id: "proj-1",
              agent_type: "render",
              session_label: "test",
              status: "spawned",
              task_description: "test task",
              dependencies: [],
              priority: 1,
              spawned_at: new Date().toISOString(),
              completed_at: null,
              result_data: null,
              created_at: new Date().toISOString(),
              cron_enabled: false,
              cron_interval: null,
              last_cron_run: null,
            },
            error: null,
          })),
        })),
      })),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
            then: (resolve: (v: unknown) => void) => resolve({ data: [], error: null }),
          })),
          eq: vi.fn(() => ({
            not: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
              then: (resolve: (v: unknown) => void) => resolve({ data: [], error: null }),
            })),
          })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      })),
    })),
    functions: {
      invoke: vi.fn(() =>
        Promise.resolve({
          data: {
            success: true,
            analysis: {
              projectType: "residential",
              style: "modern",
              budget: 10000,
              timeline: "standard",
              providedAssets: [],
              requiredDeliverables: ["renders", "shopping"],
              materials: ["wood", "marble"],
              lighting: "natural",
              dimensions: "20x15",
              clientPreferences: ["minimalist"],
            },
            engine: "gpt-4o-mini",
            renders: [
              { id: "r1", url: "https://example.com/r1.jpg", label: "View A", style: "modern", resolution: "1024x1024", generated_at: new Date().toISOString() },
            ],
            products: [],
            shopping_list: { total: 0, item_count: 0, budget_remaining: null },
          },
          error: null,
        })
      ),
    },
  },
}));

import { DesignerAgent } from "@/lib/designerAgent";

describe("DesignerAgent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should construct with project ID and brief", () => {
    const agent = new DesignerAgent("proj-1", "Modern living room design");
    expect(agent.projectId).toBe("proj-1");
    expect(agent.userBrief).toBe("Modern living room design");
  });

  it("should accept optional parameters", () => {
    const onProgress = vi.fn();
    const agent = new DesignerAgent("proj-1", "test brief", {
      onProgress,
      userId: "user-1",
      conversationHistory: ["user: hello"],
      projectType: "commercial",
      referenceImageUrls: ["https://example.com/ref.jpg"],
    });
    expect(agent.projectId).toBe("proj-1");
  });

  it("should analyze brief via edge function", async () => {
    const agent = new DesignerAgent("proj-1", "Modern minimalist living room");
    const analysis = await agent.analyzeBrief();
    expect(analysis.projectType).toBe("residential");
    expect(analysis.style).toBe("modern");
    expect(analysis.budget).toBe(10000);
    expect(analysis.materials).toEqual(["wood", "marble"]);
  });

  it("should assemble specialist team based on analysis", async () => {
    const agent = new DesignerAgent("proj-1", "Modern room with renders and shopping");
    const analysis = {
      projectType: "residential",
      style: "modern",
      budget: 10000,
      timeline: "standard",
      providedAssets: [],
      requiredDeliverables: ["renders", "shopping"],
      materials: [],
      lighting: null,
      dimensions: null,
      clientPreferences: [],
    };
    const team = await agent.assembleTeam(analysis);
    expect(team.length).toBeGreaterThan(0);
  });

  it("should load persisted results returning null for empty", async () => {
    const result = await DesignerAgent.loadPersistedResults("proj-1");
    expect(result).toBeNull();
  });

  it("should get project sessions", async () => {
    const sessions = await DesignerAgent.getProjectSessions("proj-1");
    expect(Array.isArray(sessions)).toBe(true);
  });

  it("should get project messages", async () => {
    const messages = await DesignerAgent.getProjectMessages("proj-1");
    expect(Array.isArray(messages)).toBe(true);
  });
});
