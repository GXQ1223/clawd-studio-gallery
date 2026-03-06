import { useState, useCallback, useRef } from "react";
import { DesignerAgent, type AgentSession, type OrchestrationResult } from "@/lib/designerAgent";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { FeedEntry } from "@/data/workspace-data";
import { generatePlanningQuestions, composeFinalPrompt } from "@/lib/planningQuestions";
import type { PlanningQuestion } from "@/components/workspace/PlanningQuestions";

interface ConversationEntry {
  role: "user" | "agent";
  content: string;
  timestamp: number;
}

export function useDesignerAgent(projectId: string) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const [results, setResults] = useState<OrchestrationResult | null>(null);
  const [feedEntries, setFeedEntries] = useState<FeedEntry[]>([]);
  const [acknowledgment, setAcknowledgment] = useState<string | null>(null);
  const [planningQuestions, setPlanningQuestions] = useState<PlanningQuestion[] | null>(null);
  const [pendingBrief, setPendingBrief] = useState<string | null>(null);
  const conversationRef = useRef<ConversationEntry[]>([]);
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

  /** Start planning mode — ask questions before generating */
  const startPlanning = useCallback((brief: string) => {
    setPendingBrief(brief);
    conversationRef.current.push({ role: "user", content: brief, timestamp: Date.now() });

    const questions = generatePlanningQuestions(brief);
    setPlanningQuestions(questions);

    // Show acknowledgment
    setAcknowledgment("Let me understand your vision before I start designing. A few quick questions:");
  }, []);

  /** Complete planning and run orchestration with composed prompt */
  const completePlanning = useCallback(async (answers: Record<string, string>) => {
    if (!pendingBrief) return;

    const finalPrompt = composeFinalPrompt(pendingBrief, answers);
    setPlanningQuestions(null);
    setAcknowledgment(null);

    // Store answers in conversation history
    const answerSummary = Object.entries(answers).map(([k, v]) => `${k}: ${v}`).join(", ");
    conversationRef.current.push({ role: "user", content: `Planning answers: ${answerSummary}`, timestamp: Date.now() });

    // Now run the actual orchestration
    await runOrchestrationDirect(finalPrompt);
  }, [pendingBrief]);

  /** Generate an acknowledgment for follow-up messages (not first message) */
  const generateAcknowledgment = useCallback((brief: string): string => {
    const history = conversationRef.current;
    const briefLower = brief.toLowerCase();

    if (history.length > 0) {
      if (briefLower.includes("hate") || briefLower.includes("remove") || briefLower.includes("no more")) {
        const target = brief.replace(/^(client |i |we )?(hates?|remove|no more)\s*/i, "").trim();
        return `Got it — removing ${target || "that element"}. I'll regenerate based on your existing direction.`;
      }
      if (briefLower.includes("refine") || briefLower.includes("adjust") || briefLower.includes("tweak")) {
        return `Understood — I'll make refinements based on your feedback while keeping the overall direction.`;
      }
      return `Got it — updating based on: "${brief}". Building on your previous direction.`;
    }

    return `Starting design pipeline based on your brief.`;
  }, []);

  /** Direct orchestration — skips planning (used for follow-ups and after planning completes) */
  const runOrchestrationDirect = useCallback(async (brief: string) => {
    setIsAnalyzing(true);

    try {
      const agent = new DesignerAgent(projectId, brief, {
        onProgress: (msg) => addFeedEntry(msg, true),
        userId: user?.id,
        conversationHistory: conversationRef.current.map(c => `${c.role}: ${c.content}`),
      });

      const result = await agent.runFullOrchestration();
      setResults(prev => {
        if (!prev) return result;
        return {
          renders: [...prev.renders, ...result.renders],
          products: [...prev.products, ...result.products],
          shoppingList: result.shoppingList,
        };
      });

      for (const render of result.renders) {
        addFeedEntry(`Generated: ${render.label}`);
      }
      for (const product of result.products) {
        addFeedEntry(`Found ${product.name} at ${product.brand}: $${product.price.toLocaleString()}`);
      }

      conversationRef.current.push({
        role: "agent",
        content: `Generated ${result.renders.length} renders and found ${result.products.length} products`,
        timestamp: Date.now(),
      });

      toast(`✦ ${result.renders.length} renders + ${result.products.length} products ready`);
      setAcknowledgment(null);
      return result;
    } catch (err) {
      console.error("Orchestration failed:", err);
      addFeedEntry("Orchestration failed — check console for details");
      toast.error("Orchestration failed");
      setAcknowledgment(null);
      return null;
    } finally {
      setIsAnalyzing(false);
    }
  }, [projectId, addFeedEntry, user?.id]);

  /** Main entry point — first message triggers planning, follow-ups go direct */
  const runOrchestration = useCallback(async (brief: string) => {
    const isFirstMessage = conversationRef.current.length === 0;

    if (isFirstMessage) {
      // First message → enter planning mode (ask questions)
      startPlanning(brief);
      return null;
    }

    // Follow-up messages → direct orchestration with acknowledgment
    conversationRef.current.push({ role: "user", content: brief, timestamp: Date.now() });
    const ack = generateAcknowledgment(brief);
    setAcknowledgment(ack);
    return runOrchestrationDirect(brief);
  }, [startPlanning, generateAcknowledgment, runOrchestrationDirect]);

  const refreshSessions = useCallback(async () => {
    const data = await DesignerAgent.getProjectSessions(projectId);
    setSessions(data);
    return data;
  }, [projectId]);

  return {
    runOrchestration,
    completePlanning,
    isAnalyzing,
    sessions,
    results,
    feedEntries,
    refreshSessions,
    acknowledgment,
    planningQuestions,
  };
}
