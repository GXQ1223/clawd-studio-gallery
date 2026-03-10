import { describe, it, expect, vi } from "vitest";

// Chainable query builder mock that supports arbitrary .method() chains
const qb = (result: { data: unknown; error: unknown }) => {
  const chain: any = {};
  const methods = ["select", "eq", "not", "order", "single", "insert", "update", "delete", "filter", "limit"];
  for (const m of methods) {
    chain[m] = (..._args: unknown[]) => chain;
  }
  chain.data = result.data;
  chain.error = result.error;
  // Make it thenable for await
  chain.then = (resolve: (v: unknown) => void) => resolve(result);
  return chain;
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      if (table === "agent_sessions") {
        return {
          select: () => qb({ data: [], error: null }),
          insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: { id: `session-${Date.now()}` }, error: null }) }) }),
          update: () => qb({ data: null, error: null }),
        };
      }
      if (table === "agent_messages") {
        return {
          select: () => qb({ data: [], error: null }),
          insert: () => Promise.resolve({ error: null }),
        };
      }
      return { select: () => qb({ data: [], error: null }) };
    },
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: null, error: new Error("mock") }),
    },
    storage: {
      from: () => ({
        upload: () => ({ error: null }),
        getPublicUrl: () => ({ data: { publicUrl: "https://example.com/test.png" } }),
      }),
    },
  },
}));

import { DesignerAgent } from "../designerAgent";

describe("DesignerAgent", () => {
  describe("analyzeBrief fallback (regex)", () => {
    it("detects residential project type", async () => {
      const agent = new DesignerAgent("proj-1", "Modern living room with oak flooring", {
        projectType: "interior",
      });
      const analysis = await agent.analyzeBrief();
      expect(analysis.projectType).toBeDefined();
      expect(analysis.requiredDeliverables).toContain("renders");
    });

    it("detects commercial project type from brief", async () => {
      const agent = new DesignerAgent("proj-2", "Office space renovation with modern furniture", {
        projectType: "commercial",
      });
      const analysis = await agent.analyzeBrief();
      expect(analysis).toBeDefined();
      expect(analysis.style).toBeDefined();
    });

    it("extracts budget from brief", async () => {
      const agent = new DesignerAgent("proj-3", "Redesign my apartment for $50k budget", {
        projectType: "interior",
      });
      const analysis = await agent.analyzeBrief();
      expect(analysis.budget).toBe(50000);
    });

    it("extracts style from brief", async () => {
      const agent = new DesignerAgent("proj-4", "Scandinavian bedroom with hygge vibes", {
        projectType: "interior",
      });
      const analysis = await agent.analyzeBrief();
      expect(analysis.style).toBe("scandinavian");
    });

    it("identifies deliverables from brief", async () => {
      const agent = new DesignerAgent("proj-5", "I need renders and furniture sourcing for a hotel lobby", {
        projectType: "commercial",
      });
      const analysis = await agent.analyzeBrief();
      expect(analysis.requiredDeliverables).toContain("renders");
      expect(analysis.requiredDeliverables).toContain("shopping");
    });

    it("defaults to renders and shopping when no deliverables specified", async () => {
      const agent = new DesignerAgent("proj-6", "Make my room look nice", {
        projectType: "interior",
      });
      const analysis = await agent.analyzeBrief();
      expect(analysis.requiredDeliverables).toContain("renders");
      expect(analysis.requiredDeliverables).toContain("shopping");
    });

    it("detects rush timeline", async () => {
      const agent = new DesignerAgent("proj-7", "Urgent: need renders ASAP for client meeting", {
        projectType: "interior",
      });
      const analysis = await agent.analyzeBrief();
      expect(analysis.timeline).toBe("rush");
    });
  });

  describe("static methods", () => {
    it("loadPersistedResults returns null for empty project", async () => {
      const result = await DesignerAgent.loadPersistedResults("nonexistent-project");
      expect(result).toBeNull();
    });

    it("getProjectSessions returns empty array for empty project", async () => {
      const sessions = await DesignerAgent.getProjectSessions("nonexistent-project");
      expect(sessions).toEqual([]);
    });

    it("getProjectMessages returns empty array for empty project", async () => {
      const messages = await DesignerAgent.getProjectMessages("nonexistent-project");
      expect(messages).toEqual([]);
    });
  });

  describe("runFullOrchestration", () => {
    it("returns renders and products arrays", async () => {
      const agent = new DesignerAgent("proj-8", "Modern kitchen design", {
        projectType: "interior",
        onProgress: vi.fn(),
      });
      const result = await agent.runFullOrchestration();
      expect(result).toHaveProperty("renders");
      expect(result).toHaveProperty("products");
      expect(Array.isArray(result.renders)).toBe(true);
      expect(Array.isArray(result.products)).toBe(true);
    }, 15000);
  });
});
