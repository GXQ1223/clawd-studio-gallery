import { useState, useCallback } from "react";
import { DesignerAgent, type AgentSession, type OrchestrationResult } from "@/lib/designerAgent";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { FeedEntry } from "@/data/workspace-data";

export function useDesignerAgent(projectId: string) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const [results, setResults] = useState<OrchestrationResult | null>(null);
  const [feedEntries, setFeedEntries] = useState<FeedEntry[]>([]);
  const { user } = useAuth();

  const addFeedEntry = useCallback((text: string, inProgress = false) => {
    const now = new Date();
    const time = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
    const entry: FeedEntry = {
      id: `agent-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      time,
      text,
      inProgress,
    };
    setFeedEntries((prev) => [...prev, entry]);
    return entry.id;
  }, []);

  const runOrchestration = useCallback(async (brief: string) => {
    setIsAnalyzing(true);
    setResults(null);
    setFeedEntries([]);

    try {
      const agent = new DesignerAgent(projectId, brief, {
        onProgress: (msg) => addFeedEntry(msg, true),
        userId: user?.id,
      });

      const result = await agent.runFullOrchestration();
      setResults(result);

      for (const render of result.renders) {
        addFeedEntry(`Generated: ${render.label}`);
      }
      for (const product of result.products) {
        addFeedEntry(`Found ${product.name} at ${product.brand}: $${product.price.toLocaleString()}`);
      }

      toast(`✦ ${result.renders.length} renders + ${result.products.length} products ready`);
      return result;
    } catch (err) {
      console.error("Orchestration failed:", err);
      addFeedEntry("Orchestration failed — check console for details");
      toast.error("Agent orchestration failed");
      return null;
    } finally {
      setIsAnalyzing(false);
    }
  }, [projectId, addFeedEntry, user?.id]);

  const refreshSessions = useCallback(async () => {
    const data = await DesignerAgent.getProjectSessions(projectId);
    setSessions(data);
    return data;
  }, [projectId]);

  return { runOrchestration, isAnalyzing, sessions, results, feedEntries, refreshSessions };
}
