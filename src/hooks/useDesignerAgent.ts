import { useState, useCallback } from "react";
import { DesignerAgent, type AgentSession } from "@/lib/designerAgent";
import { toast } from "sonner";

/**
 * Hook to orchestrate the Designer Agent for a project.
 * Call `spawnAgent(brief)` to analyze a brief and assemble a specialist team.
 */
export function useDesignerAgent(projectId: string) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [sessions, setSessions] = useState<AgentSession[]>([]);

  const spawnAgent = useCallback(async (brief: string) => {
    setIsAnalyzing(true);
    try {
      const agent = new DesignerAgent(projectId, brief);
      const analysis = await agent.analyzeBrief();
      const spawned = await agent.assembleTeam(analysis);
      setSessions(spawned);
      toast(`✦ ${spawned.length} specialist agents assembled`);
      return { analysis, spawned };
    } catch (err) {
      console.error("Agent orchestration failed:", err);
      toast.error("Agent orchestration failed");
      return null;
    } finally {
      setIsAnalyzing(false);
    }
  }, [projectId]);

  const refreshSessions = useCallback(async () => {
    const data = await DesignerAgent.getProjectSessions(projectId);
    setSessions(data);
    return data;
  }, [projectId]);

  return { spawnAgent, isAnalyzing, sessions, refreshSessions };
}
