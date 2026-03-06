import { useState, useCallback, useRef } from "react";
import { DesignerAgent, type AgentSession, type OrchestrationResult } from "@/lib/designerAgent";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { FeedEntry } from "@/data/workspace-data";

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

  /** Generate an acknowledgment message based on brief + conversation history */
  const generateAcknowledgment = useCallback((brief: string): string => {
    const history = conversationRef.current;
    const briefLower = brief.toLowerCase();

    // If there's prior context, reference it
    if (history.length > 0) {
      const lastUserMsg = history.filter(h => h.role === "user").pop();
      if (briefLower.includes("hate") || briefLower.includes("remove") || briefLower.includes("no more")) {
        const target = brief.replace(/^(client |i |we )?(hates?|remove|no more)\s*/i, "").trim();
        return `Got it — removing ${target || "that element"}. I'll regenerate based on your existing direction. This won't reset your other outputs.`;
      }
      if (briefLower.includes("refine") || briefLower.includes("adjust") || briefLower.includes("tweak")) {
        return `Understood — I'll make refinements based on your feedback while keeping the overall direction.`;
      }
      return `Got it — updating based on: "${brief}". Building on your previous direction.`;
    }

    // First message
    if (briefLower.includes("render") || briefLower.includes("perspective")) {
      return `I'll generate photorealistic renders based on your brief. Starting the design pipeline now.`;
    }
    if (briefLower.includes("plan") || briefLower.includes("layout")) {
      return `I'll create a spatial layout based on your requirements. Analyzing dimensions and flow.`;
    }
    return `Starting design pipeline: I'll analyze your brief, generate renders, and source matching products.`;
  }, []);

  const runOrchestration = useCallback(async (brief: string) => {
    setIsAnalyzing(true);

    // Generate acknowledgment first
    const ack = generateAcknowledgment(brief);
    setAcknowledgment(ack);

    // Store in conversation history
    conversationRef.current.push({ role: "user", content: brief, timestamp: Date.now() });

    try {
      const agent = new DesignerAgent(projectId, brief, {
        onProgress: (msg) => addFeedEntry(msg, true),
        userId: user?.id,
        conversationHistory: conversationRef.current.map(c => `${c.role}: ${c.content}`),
      });

      const result = await agent.runFullOrchestration();
      setResults(prev => {
        // Merge with previous results instead of replacing
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

      // Store agent response in history
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
  }, [projectId, addFeedEntry, user?.id, generateAcknowledgment]);

  const refreshSessions = useCallback(async () => {
    const data = await DesignerAgent.getProjectSessions(projectId);
    setSessions(data);
    return data;
  }, [projectId]);

  return { runOrchestration, isAnalyzing, sessions, results, feedEntries, refreshSessions, acknowledgment };
}
